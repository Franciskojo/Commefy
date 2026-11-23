import "server-only";
import { ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { sha256Hex } from "@/lib/security/crypto";
import { Errors } from "@/lib/errors";
import type { CartDoc, CartItem } from "@/lib/db/types";

const CART_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function getOrCreateCart(params: {
  tenantId: ObjectId;
  cartToken?: string;
  customerId?: ObjectId;
}): Promise<{ cart: CartDoc; cartToken?: string }> {
  const db = await tenantDb(params.tenantId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CART_TTL_MS);

  // If customer is logged in, lookup customer cart
  if (params.customerId) {
    let cart = await db.carts.findOne({ customerId: params.customerId });
    if (!cart) {
      const newCart: CartDoc = {
        _id: new ObjectId(),
        tenantId: params.tenantId,
        customerId: params.customerId,
        items: [],
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };
      await db.carts.insertOne(newCart);
      return { cart: newCart };
    }
    return { cart };
  }

  // Anonymous cart with token
  if (params.cartToken) {
    const tokenHash = sha256Hex(params.cartToken);
    const cart = await db.carts.findOne({ tokenHash });
    if (cart) return { cart, cartToken: params.cartToken };
  }

  // Create new anonymous cart
  const { randomToken } = await import("@/lib/security/crypto");
  const newToken = randomToken(32);
  const tokenHash = sha256Hex(newToken);

  const newCart: CartDoc = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    tokenHash,
    items: [],
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  await db.carts.insertOne(newCart);
  return { cart: newCart, cartToken: newToken };
}

export async function addItemToCart(params: {
  tenantId: ObjectId;
  cartId: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  quantity: number;
}): Promise<CartDoc> {
  if (params.quantity <= 0 || !Number.isSafeInteger(params.quantity)) {
    throw Errors.validation("Quantity must be a positive integer");
  }

  const db = await tenantDb(params.tenantId);
  const cart = await db.carts.findOne({ _id: params.cartId });
  if (!cart) throw Errors.notFound("Cart not found");

  // Verify product and variant exist in store
  const prod = await db.products.findOne({ _id: params.productId, status: "active" });
  if (!prod) throw Errors.notFound("Product not found");
  const variant = prod.variants.find((v) => v._id.equals(params.variantId));
  if (!variant) throw Errors.notFound("Variant not found");

  const existingIdx = cart.items.findIndex((i) => i.variantId.equals(params.variantId));
  const now = new Date();

  if (existingIdx > -1) {
    cart.items[existingIdx].quantity += params.quantity;
  } else {
    cart.items.push({
      productId: params.productId,
      variantId: params.variantId,
      quantity: params.quantity,
      addedAt: now,
    });
  }

  await db.carts.updateOne(
    { _id: params.cartId },
    { $set: { items: cart.items, updatedAt: now } },
  );

  return cart;
}

export async function updateCartItemQuantity(params: {
  tenantId: ObjectId;
  cartId: ObjectId;
  variantId: ObjectId;
  quantity: number;
}): Promise<CartDoc> {
  const db = await tenantDb(params.tenantId);
  const cart = await db.carts.findOne({ _id: params.cartId });
  if (!cart) throw Errors.notFound("Cart not found");

  const now = new Date();
  if (params.quantity <= 0) {
    cart.items = cart.items.filter((i) => !i.variantId.equals(params.variantId));
  } else {
    const item = cart.items.find((i) => i.variantId.equals(params.variantId));
    if (item) {
      item.quantity = params.quantity;
    }
  }

  await db.carts.updateOne(
    { _id: params.cartId },
    { $set: { items: cart.items, updatedAt: now } },
  );

  return cart;
}

/**
 * Reconcile anonymous cart items with customer cart upon login.
 */
export async function reconcileCartOnLogin(params: {
  tenantId: ObjectId;
  anonymousCartToken: string;
  customerId: ObjectId;
}): Promise<void> {
  const db = await tenantDb(params.tenantId);
  const tokenHash = sha256Hex(params.anonymousCartToken);
  const anonCart = await db.carts.findOne({ tokenHash });
  if (!anonCart || anonCart.items.length === 0) return;

  const { cart: customerCart } = await getOrCreateCart({
    tenantId: params.tenantId,
    customerId: params.customerId,
  });

  const merged = [...customerCart.items];
  for (const item of anonCart.items) {
    const idx = merged.findIndex((i) => i.variantId.equals(item.variantId));
    if (idx > -1) {
      merged[idx].quantity += item.quantity;
    } else {
      merged.push(item);
    }
  }

  const now = new Date();
  await db.carts.updateOne(
    { _id: customerCart._id },
    { $set: { items: merged, updatedAt: now } },
  );

  // Clean up anonymous cart
  await db.carts.deleteOne({ _id: anonCart._id });
}
