import "server-only";
import type {
  AggregateOptions,
  BulkWriteOptions,
  ClientSession,
  Collection,
  CountDocumentsOptions,
  DeleteOptions,
  Document,
  Filter,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertOneOptions,
  ObjectId,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  WithId,
} from "mongodb";
import { getDb } from "./client";
import { TENANT_COLLECTIONS, type TenantCollectionName, type TenantCollections } from "./collections";

/**
 * Tenant-scoped data access.
 *
 * Every operation injects `tenantId` into the filter (or document) and refuses updates that
 * would modify `tenantId`. Aggregations get a leading `$match` and cross-collection stages
 * (`$lookup`, `$unionWith`, `$graphLookup`, `$out`, `$merge`) are rejected because they could
 * escape the tenant boundary – perform separate scoped queries instead.
 */

export class TenantScopeViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeViolation";
  }
}

const FORBIDDEN_STAGES = ["$lookup", "$unionWith", "$graphLookup", "$out", "$merge", "$documents"];
const UPDATE_OPERATORS = ["$set", "$unset", "$rename", "$setOnInsert", "$inc", "$push", "$pull", "$addToSet", "$min", "$max", "$mul", "$currentDate", "$pop", "$pullAll"];

type TenantDocument = Document & { tenantId: ObjectId };
export type ScopedInsertDoc<TSchema> = Omit<TSchema, "tenantId" | "_id"> & {
  _id?: ObjectId;
};

function sameId(a: unknown, b: ObjectId): boolean {
  return typeof a === "object" && a !== null && "equals" in a && typeof (a as ObjectId).equals === "function"
    ? (a as ObjectId).equals(b)
    : false;
}

export class TenantScopedCollection<TSchema extends TenantDocument> {
  constructor(
    readonly tenantId: ObjectId,
    private readonly col: Collection<TSchema>,
  ) {}

  get collectionName(): string {
    return this.col.collectionName;
  }

  /** Builds a filter that is always restricted to this tenant. */
  scope(filter: Filter<TSchema> = {}): Filter<TSchema> {
    const f = filter as Record<string, unknown>;
    if ("tenantId" in f && !sameId(f.tenantId, this.tenantId)) {
      throw new TenantScopeViolation(`Filter on ${this.collectionName} attempted to target another tenant`);
    }
    return { ...f, tenantId: this.tenantId } as Filter<TSchema>;
  }

  private guardUpdate(update: UpdateFilter<TSchema> | Document[]): void {
    if (Array.isArray(update)) {
      throw new TenantScopeViolation("Pipeline-style updates are not allowed through the scoped wrapper");
    }
    const u = update as Record<string, unknown>;
    for (const key of Object.keys(u)) {
      if (!key.startsWith("$")) throw new TenantScopeViolation("Replacement documents are not allowed; use update operators");
    }
    for (const op of UPDATE_OPERATORS) {
      const body = u[op];
      if (body && typeof body === "object" && Object.keys(body).some((k) => k === "tenantId" || k.startsWith("tenantId."))) {
        throw new TenantScopeViolation(`Update attempted to modify tenantId on ${this.collectionName}`);
      }
    }
  }

  find(filter: Filter<TSchema> = {}, options?: FindOptions) {
    return this.col.find(this.scope(filter), options);
  }

  findOne(filter: Filter<TSchema> = {}, options?: FindOptions): Promise<WithId<TSchema> | null> {
    return this.col.findOne(this.scope(filter), options);
  }

  countDocuments(filter: Filter<TSchema> = {}, options?: CountDocumentsOptions): Promise<number> {
    return this.col.countDocuments(this.scope(filter), options);
  }

  distinct(key: string, filter: Filter<TSchema> = {}, options?: { session?: ClientSession }) {
    return this.col.distinct(key, this.scope(filter), options ?? {});
  }

  insertOne(doc: ScopedInsertDoc<TSchema>, options?: InsertOneOptions) {
    const d = doc as Record<string, unknown>;
    if ("tenantId" in d && !sameId(d.tenantId, this.tenantId)) {
      throw new TenantScopeViolation(`Insert into ${this.collectionName} attempted to target another tenant`);
    }
    return this.col.insertOne({ ...d, tenantId: this.tenantId } as unknown as OptionalUnlessRequiredId<TSchema>, options);
  }

  insertMany(docs: ScopedInsertDoc<TSchema>[], options?: BulkWriteOptions) {
    const scoped = docs.map((doc) => {
      const d = doc as Record<string, unknown>;
      if ("tenantId" in d && !sameId(d.tenantId, this.tenantId)) {
        throw new TenantScopeViolation(`Insert into ${this.collectionName} attempted to target another tenant`);
      }
      return { ...d, tenantId: this.tenantId } as unknown as OptionalUnlessRequiredId<TSchema>;
    });
    return this.col.insertMany(scoped, options);
  }

  updateOne(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: UpdateOptions) {
    this.guardUpdate(update);
    return this.col.updateOne(this.scope(filter), update, options);
  }

  updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: UpdateOptions) {
    this.guardUpdate(update);
    return this.col.updateMany(this.scope(filter), update, options);
  }

  findOneAndUpdate(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema>,
    options: FindOneAndUpdateOptions = {},
  ): Promise<WithId<TSchema> | null> {
    this.guardUpdate(update);
    return this.col.findOneAndUpdate(this.scope(filter), update, { ...options, includeResultMetadata: false });
  }

  deleteOne(filter: Filter<TSchema>, options?: DeleteOptions) {
    return this.col.deleteOne(this.scope(filter), options);
  }

  deleteMany(filter: Filter<TSchema>, options?: DeleteOptions) {
    return this.col.deleteMany(this.scope(filter), options);
  }

  aggregate<R extends Document = Document>(pipeline: Document[], options?: AggregateOptions) {
    for (const stage of pipeline) {
      for (const key of Object.keys(stage)) {
        if (FORBIDDEN_STAGES.includes(key)) {
          throw new TenantScopeViolation(`${key} is not permitted in tenant-scoped aggregations`);
        }
      }
    }
    return this.col.aggregate<R>([{ $match: { tenantId: this.tenantId } }, ...pipeline], options);
  }
}

export type TenantDb = { readonly tenantId: ObjectId } & {
  readonly [K in TenantCollectionName]: TenantScopedCollection<TenantCollections[K]>;
};

/**
 * Returns scoped handles to every tenant-owned collection. The tenant id must come from a
 * trusted server-side source (resolved host or verified membership) – never from client input.
 */
export async function tenantDb(tenantId: ObjectId): Promise<TenantDb> {
  if (!tenantId) throw new TenantScopeViolation("tenantDb() requires a tenant id");
  const db = await getDb();
  const handles: Record<string, unknown> = { tenantId };
  for (const name of TENANT_COLLECTIONS) {
    handles[name] = new TenantScopedCollection(tenantId, db.collection(name) as Collection<TenantDocument>);
  }
  return handles as TenantDb;
}
