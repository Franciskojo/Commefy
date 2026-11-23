import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Pooled MongoDB client shared across requests (and across HMR reloads in development).
 * Never instantiate a client per request.
 */

type Cache = { client?: MongoClient; promise?: Promise<MongoClient> };

const g = globalThis as typeof globalThis & { __sfMongo?: Cache };
const cache: Cache = (g.__sfMongo ??= {});
const dbLogger = logger.child({ component: "mongodb" });

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;
  if (!cache.promise) {
    let env;
    try {
      env = getEnv();
    } catch (err: unknown) {
      console.error(
        "✗ [MongoDB] Not connected:",
        err instanceof Error ? err.message : err,
      );
      dbLogger.error("MongoDB not connected", { err });
      throw err;
    }
    const client = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000,
      retryWrites: true,
      appName: "storeforge",
    });

    client.on("close", () => {
      console.warn(`[MongoDB] Disconnected (db: ${env.MONGODB_DB})`);
      dbLogger.warn("MongoDB disconnected", { db: env.MONGODB_DB });
    });

    cache.promise = client
      .connect()
      .then(async (c) => {
        await c.db(env.MONGODB_DB).command({ ping: 1 });
        cache.client = c;
        console.log(`✓ [MongoDB] Connected (db: ${env.MONGODB_DB})`);
        dbLogger.info("MongoDB connected", { db: env.MONGODB_DB });
        return c;
      })
      .catch((err: unknown) => {
        cache.promise = undefined;
        console.error(
          `✗ [MongoDB] Not connected (db: ${env.MONGODB_DB}):`,
          err instanceof Error ? err.message : err,
        );
        dbLogger.error("MongoDB not connected", { db: env.MONGODB_DB, err });
        throw err;
      });
  }
  return cache.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getEnv().MONGODB_DB);
}

/** Used by tests and scripts to close the shared pool. */
export async function closeMongo(): Promise<void> {
  const c = cache.client;
  cache.client = undefined;
  cache.promise = undefined;
  if (c) await c.close();
}
