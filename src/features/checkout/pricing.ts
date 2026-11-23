import "server-only";
import { type ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { Errors } from "@/lib/errors";
import {
  addMinor,
  multiplyMinor,
  applyBps,
  allocateProportionally,
  type CurrencyCode,
} from "@/lib/money";
import type { Address, OrderItemSnapshot, ShippingMethod } from "@/lib/db/types";

export interface ComputeQuoteInput {
  tenantId: ObjectId;
  items: { productId: ObjectId; variantId: ObjectId; quantity: number }[];
  discountCode?: string;
  shippingAddress?: Address;
  shippingMethodId?: string;
}

export interface QuoteResult {
  items: OrderItemSnapshot[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: CurrencyCode;
  pricesIncludeTax: boolean;
  selectedShippingMethod?: ShippingMethod;
  appliedDiscount?: {
    discountId: ObjectId;
    code: string;
    type: "percentage" | "fixed" | "free_shipping";
    value: number;
  };
  taxLines: { name: string; rateBps: number; amount: number }[];
}

export async function computeQuote(input: ComputeQuoteInput): Promise<QuoteResult> {
  const db = await tenantDb(input.tenantId);

  // 1. Fetch store settings
  const settings = await db.storeSettings.findOne({});
  const currency: CurrencyCode = settings?.currency || "USD";
  const pricesIncludeTax = settings?.tax?.pricesIncludeTax ?? false;

  if (input.items.length === 0) {
    throw Errors.validation("Cart is empty");
  }

  // 2. Fetch fresh products from database (NEVER TRUST CLIENT PRICES)
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await db.products.find({ _id: { $in: productIds }, status: "active" }).toArray();
  const productMap = new Map(products.map((p) => [p._id.toHexString(), p]));

  const itemSnapshots: OrderItemSnapshot[] = [];

  for (const item of input.items) {
    if (item.quantity <= 0 || !Number.isSafeInteger(item.quantity)) {
      throw Errors.validation("Item quantities must be positive integers");
    }

    const prod = productMap.get(item.productId.toHexString());
    if (!prod) {
      throw Errors.notFound(`Product not found or unavailable: ${item.productId.toHexString()}`);
    }

    const variant = prod.variants.find((v) => v._id.equals(item.variantId));
    if (!variant) {
      throw Errors.notFound(`Product variant not found: ${item.variantId.toHexString()}`);
    }

    // Server-authoritative price: salePrice if present and valid, otherwise regular price
    const unitPrice =
      variant.salePrice !== undefined && variant.salePrice < variant.price
        ? variant.salePrice
        : variant.price;

    const lineSubtotal = multiplyMinor(unitPrice, item.quantity);

    itemSnapshots.push({
      productId: prod._id,
      variantId: variant._id,
      name: prod.name,
      variantTitle: variant.title,
      sku: variant.sku,
      imageUrl: prod.images?.[0]?.url,
      unitPrice,
      regularPrice: variant.price,
      quantity: item.quantity,
      lineSubtotal,
      lineDiscount: 0,
      lineTax: 0,
      lineTotal: lineSubtotal,
    });
  }

  const subtotal = addMinor(...itemSnapshots.map((i) => i.lineSubtotal));

  // 3. Discount calculation
  let discountTotal = 0;
  let appliedDiscount: QuoteResult["appliedDiscount"];

  if (input.discountCode) {
    const code = input.discountCode.trim().toUpperCase();
    const discount = await db.discounts.findOne({ code, active: true });
    const now = new Date();

    if (
      discount &&
      (!discount.startsAt || now >= discount.startsAt) &&
      (!discount.endsAt || now <= discount.endsAt) &&
      (discount.usageLimit === undefined || discount.usageCount < discount.usageLimit) &&
      subtotal >= discount.minSubtotal
    ) {
      if (discount.type === "percentage") {
        discountTotal = applyBps(subtotal, discount.value);
      } else if (discount.type === "fixed") {
        discountTotal = Math.min(discount.value, subtotal);
      }
      appliedDiscount = {
        discountId: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
      };
    }
  }

  // Allocate order-level discount across lines
  if (discountTotal > 0) {
    const weights = itemSnapshots.map((i) => i.lineSubtotal);
    const lineDiscounts = allocateProportionally(discountTotal, weights);
    for (let i = 0; i < itemSnapshots.length; i++) {
      itemSnapshots[i].lineDiscount = lineDiscounts[i];
      itemSnapshots[i].lineTotal = itemSnapshots[i].lineSubtotal - lineDiscounts[i];
    }
  }

  // 4. Shipping calculation
  let shippingTotal = 0;
  let selectedShippingMethod: ShippingMethod | undefined;

  if (input.shippingAddress && input.shippingMethodId && settings?.shipping?.zones) {
    const country = input.shippingAddress.country.toUpperCase();
    // Match zone: specific country or wildcard '*'
    const zone =
      settings.shipping.zones.find((z) => z.countries.includes(country)) ||
      settings.shipping.zones.find((z) => z.countries.includes("*"));

    if (zone) {
      selectedShippingMethod = zone.methods.find((m) => m.id === input.shippingMethodId);
      if (selectedShippingMethod) {
        if (
          appliedDiscount?.type === "free_shipping" ||
          (selectedShippingMethod.freeOver !== undefined && subtotal >= selectedShippingMethod.freeOver)
        ) {
          shippingTotal = 0;
        } else {
          shippingTotal = selectedShippingMethod.rate;
        }
      }
    }
  }

  // 5. Tax calculation
  let taxTotal = 0;
  const taxLines: QuoteResult["taxLines"] = [];

  if (input.shippingAddress && settings?.tax?.rules) {
    const country = input.shippingAddress.country.toUpperCase();
    const rules = settings.tax.rules.filter((r) => r.country === country || r.country === "*");

    for (const rule of rules) {
      if (rule.rateBps <= 0) continue;
      const taxableBase = subtotal - discountTotal + (rule.appliesToShipping ? shippingTotal : 0);
      const taxAmount = applyBps(Math.max(0, taxableBase), rule.rateBps);

      taxLines.push({
        name: rule.name,
        rateBps: rule.rateBps,
        amount: taxAmount,
      });

      if (!pricesIncludeTax) {
        taxTotal = addMinor(taxTotal, taxAmount);
      }
    }
  }

  const total = Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal);

  return {
    items: itemSnapshots,
    subtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    total,
    currency,
    pricesIncludeTax,
    selectedShippingMethod,
    appliedDiscount,
    taxLines,
  };
}
