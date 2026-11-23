import "server-only";
import { type ClientSession, type ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { Errors } from "@/lib/errors";
import type { StockMovementReason } from "@/lib/db/types";

export interface ReservationItem {
  productId: ObjectId;
  variantId: ObjectId;
  quantity: number;
}

/**
 * Atomically reserve stock for an order during checkout.
 * Enforces nonnegative available inventory (onHand - reserved >= qty) unless backorders are enabled.
 */
export async function reserveInventory(
  session: ClientSession,
  tenantId: ObjectId,
  items: ReservationItem[],
  allowBackorders = false,
  orderId?: ObjectId,
): Promise<void> {
  const db = await tenantDb(tenantId);

  for (const item of items) {
    if (item.quantity <= 0) continue;

    let res;
    if (allowBackorders) {
      res = await db.inventory.findOneAndUpdate(
        { variantId: item.variantId },
        {
          $inc: { reserved: item.quantity },
          $set: { updatedAt: new Date() },
        },
        { session, returnDocument: "after" },
      );
    } else {
      // Atomic conditional update ensuring available stock >= requested quantity
      res = await db.inventory.findOneAndUpdate(
        {
          variantId: item.variantId,
          $expr: {
            $gte: [{ $subtract: ["$onHand", "$reserved"] }, item.quantity],
          },
        },
        {
          $inc: { reserved: item.quantity },
          $set: { updatedAt: new Date() },
        },
        { session, returnDocument: "after" },
      );
    }

    if (!res) {
      throw Errors.insufficientStock(
        "One or more items in your cart are no longer available in the requested quantity.",
      );
    }

    // Record movement
    await db.stockMovements.insertOne(
      {
        productId: item.productId,
        variantId: item.variantId,
        reason: "order_reserved",
        deltaOnHand: 0,
        deltaReserved: item.quantity,
        orderId,
        createdAt: new Date(),
      },
      { session },
    );
  }
}

/**
 * Release reserved inventory (e.g. on checkout expiry, payment cancellation, or order cancellation).
 */
export async function releaseInventory(
  session: ClientSession,
  tenantId: ObjectId,
  items: ReservationItem[],
  orderId?: ObjectId,
): Promise<void> {
  const db = await tenantDb(tenantId);

  for (const item of items) {
    if (item.quantity <= 0) continue;

    await db.inventory.updateOne(
      { variantId: item.variantId },
      {
        $inc: { reserved: -item.quantity },
        $set: { updatedAt: new Date() },
      },
      { session },
    );

    await db.stockMovements.insertOne(
      {
        productId: item.productId,
        variantId: item.variantId,
        reason: "order_released",
        deltaOnHand: 0,
        deltaReserved: -item.quantity,
        orderId,
        createdAt: new Date(),
      },
      { session },
    );
  }
}

/**
 * Commit reserved inventory on payment confirmation:
 * Reduces both onHand and reserved count.
 */
export async function commitInventory(
  session: ClientSession,
  tenantId: ObjectId,
  items: ReservationItem[],
  orderId?: ObjectId,
): Promise<void> {
  const db = await tenantDb(tenantId);

  for (const item of items) {
    if (item.quantity <= 0) continue;

    await db.inventory.updateOne(
      { variantId: item.variantId },
      {
        $inc: { onHand: -item.quantity, reserved: -item.quantity },
        $set: { updatedAt: new Date() },
      },
      { session },
    );

    await db.stockMovements.insertOne(
      {
        productId: item.productId,
        variantId: item.variantId,
        reason: "order_committed",
        deltaOnHand: -item.quantity,
        deltaReserved: -item.quantity,
        orderId,
        createdAt: new Date(),
      },
      { session },
    );
  }
}

/**
 * Manual inventory adjustment with full audit trail.
 */
export async function adjustInventory(params: {
  tenantId: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  sku: string;
  delta: number;
  reason: StockMovementReason;
  actorUserId: ObjectId;
  note?: string;
}): Promise<void> {
  const db = await tenantDb(params.tenantId);

  await db.inventory.updateOne(
    { variantId: params.variantId },
    {
      $inc: { onHand: params.delta },
      $setOnInsert: {
        productId: params.productId,
        sku: params.sku,
        reserved: 0,
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );

  await db.stockMovements.insertOne({
    productId: params.productId,
    variantId: params.variantId,
    reason: params.reason,
    deltaOnHand: params.delta,
    deltaReserved: 0,
    actorUserId: params.actorUserId,
    note: params.note,
    createdAt: new Date(),
  });
}
