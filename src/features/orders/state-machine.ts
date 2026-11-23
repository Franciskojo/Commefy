import type { OrderStatus } from "@/lib/db/types";

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "partially_refunded", "refunded"],
  processing: ["shipped", "cancelled", "partially_refunded", "refunded"],
  shipped: ["delivered", "partially_refunded", "refunded"],
  delivered: ["partially_refunded", "refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  cancelled: [], // Terminal
  refunded: [], // Terminal
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true; // Idempotent no-op
  const allowed = VALID_ORDER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertValidOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order status transition from '${from}' to '${to}'`);
  }
}
