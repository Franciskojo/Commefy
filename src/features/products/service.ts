import "server-only";
import { ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { rawTenantCollection } from "@/lib/db/collections";
import { slugify } from "@/lib/security/sanitize";
import { Errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { assertPlanLimit } from "@/features/subscriptions/service";
import type { ProductDoc, CategoryDoc, ProductVariant, ProductImage } from "@/lib/db/types";

export interface CreateProductInput {
  tenantId: ObjectId;
  actorUserId: ObjectId;
  name: string;
  slug?: string;
  description: string;
  brand?: string;
  categoryIds?: ObjectId[];
  tags?: string[];
  images?: ProductImage[];
  featured?: boolean;
  seo?: { title?: string; description?: string };
  variants: {
    sku: string;
    title: string;
    options: Record<string, string>;
    price: number; // minor units
    salePrice?: number;
    initialStock?: number;
  }[];
}

export async function createProduct(input: CreateProductInput): Promise<ProductDoc> {
  const db = await tenantDb(input.tenantId);

  // 1. Enforce SaaS Plan product limit on server
  await assertPlanLimit(input.tenantId, "products");

  // 2. Validate input
  if (!input.name || input.name.trim().length === 0) {
    throw Errors.validation("Product name is required");
  }
  if (!input.variants || input.variants.length === 0) {
    throw Errors.validation("Product must have at least one variant");
  }

  const slug = slugify(input.slug || input.name);
  const existing = await db.products.findOne({ slug });
  if (existing) {
    throw Errors.conflict("A product with this URL slug already exists");
  }

  // Calculate denormalized minimum price across variants for quick sorting
  let priceMin = Number.MAX_SAFE_INTEGER;
  const variants: ProductVariant[] = [];
  const inventoryItemsToInsert: { variantId: ObjectId; sku: string; initialStock: number }[] = [];

  for (const v of input.variants) {
    if (v.price < 0 || !Number.isSafeInteger(v.price)) {
      throw Errors.validation(`Invalid price for variant ${v.title}`);
    }
    const effectivePrice = v.salePrice !== undefined && v.salePrice < v.price ? v.salePrice : v.price;
    if (effectivePrice < priceMin) priceMin = effectivePrice;

    const variantId = new ObjectId();
    variants.push({
      _id: variantId,
      sku: v.sku.trim().toUpperCase(),
      title: v.title.trim(),
      options: v.options || {},
      price: v.price,
      ...(v.salePrice !== undefined ? { salePrice: v.salePrice } : {}),
    });

    inventoryItemsToInsert.push({
      variantId,
      sku: v.sku.trim().toUpperCase(),
      initialStock: Math.max(0, v.initialStock || 0),
    });
  }

  if (priceMin === Number.MAX_SAFE_INTEGER) priceMin = 0;

  const productId = new ObjectId();
  const now = new Date();

  const productDoc: ProductDoc = {
    _id: productId,
    tenantId: input.tenantId,
    name: input.name.trim(),
    slug,
    description: input.description.trim(),
    brand: input.brand?.trim(),
    status: "active",
    categoryIds: input.categoryIds || [],
    tags: (input.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    images: input.images || [],
    options: [],
    variants,
    featured: input.featured ?? false,
    seo: input.seo || {},
    priceMin,
    ratingAvg: 0,
    ratingCount: 0,
    salesCount: 0,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.products.insertOne(productDoc);

  // Initialize inventory for each variant
  for (const inv of inventoryItemsToInsert) {
    await db.inventory.insertOne({
      _id: new ObjectId(),
      productId,
      variantId: inv.variantId,
      sku: inv.sku,
      onHand: inv.initialStock,
      reserved: 0,
      updatedAt: now,
    });
  }

  await recordAudit({
    tenantId: input.tenantId,
    category: "commerce",
    action: "product.created",
    outcome: "success",
    actor: { type: "user", id: input.actorUserId.toHexString() },
    target: { type: "product", id: productId.toHexString() },
    metadata: { name: productDoc.name, slug, variantCount: variants.length },
  });

  return productDoc;
}

export interface ListProductsQuery {
  tenantId: ObjectId;
  categoryId?: ObjectId;
  search?: string;
  status?: "active" | "draft" | "archived";
  featured?: boolean;
  sort?: "price_asc" | "price_desc" | "newest" | "best_selling";
  page?: number;
  limit?: number;
}

export async function listProducts(query: ListProductsQuery): Promise<{
  products: ProductDoc[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const db = await tenantDb(query.tenantId);
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter["status"] = query.status;
  } else {
    filter["status"] = "active"; // Default to active products for public storefront
  }

  if (query.categoryId) {
    filter["categoryIds"] = query.categoryId;
  }

  if (query.featured !== undefined) {
    filter["featured"] = query.featured;
  }

  if (query.search && query.search.trim().length > 0) {
    filter["$text"] = { $search: query.search.trim() };
  }

  const sort: Record<string, 1 | -1> = {};
  if (query.sort === "price_asc") sort["priceMin"] = 1;
  else if (query.sort === "price_desc") sort["priceMin"] = -1;
  else if (query.sort === "best_selling") sort["salesCount"] = -1;
  else sort["createdAt"] = -1; // Default newest

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 24));
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    db.products.find(filter, { sort, skip, limit }).toArray(),
    db.products.countDocuments(filter),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getProductBySlug(tenantId: ObjectId, slug: string): Promise<ProductDoc | null> {
  const db = await tenantDb(tenantId);
  return db.products.findOne({ slug: slug.toLowerCase() });
}

export async function createCategory(params: {
  tenantId: ObjectId;
  name: string;
  slug?: string;
  description?: string;
  parentId?: ObjectId;
  imageUrl?: string;
}): Promise<CategoryDoc> {
  const db = await tenantDb(params.tenantId);
  const slug = slugify(params.slug || params.name);

  const existing = await db.categories.findOne({ slug });
  if (existing) {
    throw Errors.conflict("Category slug already exists");
  }

  const categoryDoc: CategoryDoc = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    name: params.name.trim(),
    slug,
    description: params.description?.trim(),
    parentId: params.parentId,
    sortOrder: 0,
    imageUrl: params.imageUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.categories.insertOne(categoryDoc);
  return categoryDoc;
}

export async function listCategories(tenantId: ObjectId): Promise<CategoryDoc[]> {
  const db = await tenantDb(tenantId);
  return db.categories.find({}, { sort: { sortOrder: 1, name: 1 } }).toArray();
}
