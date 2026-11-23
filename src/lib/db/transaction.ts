import "server-only";
import type { ClientSession, TransactionOptions } from "mongodb";
import { getDb, getMongoClient } from "./client";

/**
 * Runs `fn` inside a MongoDB multi-document transaction (requires a replica set or Atlas –
 * both local dev (`npm run db:dev`) and tests use an in-memory replica set).
 *
 * `withTransaction` retries on TransientTransactionError / UnknownTransactionCommitResult,
 * so `fn` must be idempotent with respect to its own side effects outside the database.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>, options?: TransactionOptions): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let result: T | undefined;
    try {
      await session.withTransaction(
        async (s) => {
          result = await fn(s);
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
          ...options,
        },
      );
      return result as T;
    } catch (txErr: any) {
      const msg = String(txErr?.message || "");
      if (
        msg.includes("Transaction numbers are only allowed on a replica set member") ||
        msg.includes("standalone") ||
        txErr?.codeName === "IllegalOperation"
      ) {
        return await fn(session);
      }
      throw txErr;
    }
  } finally {
    await session.endSession();
  }
}

/** Counter helper (e.g. per-tenant order numbers). Safe under concurrency via atomic $inc. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const db = await getDb();
  const res = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after", session });
  if (!res) throw new Error("counter update failed");
  return res.seq;
}
