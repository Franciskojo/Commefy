import { NextRequest, NextResponse } from "next/server";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { releaseInventory } from "@/features/inventory/service";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const env = getEnv();
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (env.CRON_SECRET && !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    expiredReservationsCount: 0,
    jobsProcessed: 0,
  };

  try {
    // 1. Sweep expired checkout reservations
    const now = new Date();
    const rawOrders = await rawTenantCollection("orders");

    const expiredOrders = await rawOrders
      .find({
        status: "pending_payment",
        "reservation.status": "held",
        "reservation.expiresAt": { $lt: now },
      })
      .limit(50)
      .toArray();

    for (const order of expiredOrders) {
      try {
        const items = order.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        }));

        const { withTransaction } = await import("@/lib/db/transaction");
        await withTransaction(async (session) => {
          await releaseInventory(session, order.tenantId, items, order._id);
          await rawOrders.updateOne(
            { _id: order._id, status: "pending_payment" },
            {
              $set: {
                status: "cancelled",
                cancelReason: "Checkout reservation expired",
                "reservation.status": "released",
                updatedAt: new Date(),
              },
            },
            { session },
          );
        });

        results.expiredReservationsCount++;
      } catch (err) {
        logger.error("Failed to release expired order reservation", { orderId: order._id, err });
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    logger.error("Cron jobs runner error", { err: err?.message });
    return NextResponse.json({ error: "Job execution error" }, { status: 500 });
  }
}
