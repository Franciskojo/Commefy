import "server-only";
import { type ObjectId } from "mongodb";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { Errors } from "@/lib/errors";
import type { SubscriptionPlanDoc, SubscriptionDoc, PlanFeatures, PlanLimits } from "@/lib/db/types";

export const DEFAULT_PLANS: SubscriptionPlanDoc[] = [
  {
    _id: "free",
    name: "Starter Free",
    description: "Everything you need to launch your first online store.",
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    trialDays: 0,
    limits: {
      products: 25,
      staff: 2,
      ordersPerMonth: 100,
    },
    features: {
      customDomain: false,
      advancedAnalytics: false,
      discounts: true,
      removeBranding: false,
    },
    active: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "pro",
    name: "Professional",
    description: "For growing businesses ready to scale with custom domains and analytics.",
    priceMonthly: 2900, // $29.00
    priceAnnual: 29000, // $290.00 (2 months free)
    currency: "USD",
    trialDays: 14,
    limits: {
      products: 500,
      staff: 10,
      ordersPerMonth: 2500,
    },
    features: {
      customDomain: true,
      advancedAnalytics: true,
      discounts: true,
      removeBranding: true,
    },
    active: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: "enterprise",
    name: "Enterprise",
    description: "Unlimited scale, dedicated support, and custom integrations.",
    priceMonthly: 9900, // $99.00
    priceAnnual: 99000,
    currency: "USD",
    trialDays: 14,
    limits: {
      products: -1, // Unlimited
      staff: -1,
      ordersPerMonth: -1,
    },
    features: {
      customDomain: true,
      advancedAnalytics: true,
      discounts: true,
      removeBranding: true,
    },
    active: true,
    sortOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function ensureDefaultPlans(): Promise<void> {
  const col = await platformCollection("subscriptionPlans");
  for (const plan of DEFAULT_PLANS) {
    await col.updateOne({ _id: plan._id }, { $setOnInsert: plan }, { upsert: true });
  }
}

export async function getTenantSubscription(tenantId: ObjectId): Promise<{
  subscription: SubscriptionDoc;
  plan: SubscriptionPlanDoc;
}> {
  const rawSubs = await rawTenantCollection("subscriptions");
  let sub = await rawSubs.findOne({ tenantId });

  const plansCol = await platformCollection("subscriptionPlans");

  if (!sub) {
    // Default to free plan if none found
    const now = new Date();
    sub = {
      _id: new (await import("mongodb")).ObjectId(),
      tenantId,
      planId: "free",
      status: "active",
      interval: "month",
      provider: "manual",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
    await rawSubs.insertOne(sub);
  }

  const plan = (await plansCol.findOne({ _id: sub.planId })) || DEFAULT_PLANS[0];
  return { subscription: sub, plan };
}

/**
 * Server-side plan limit enforcement.
 * Checks actual resource usage in database and rejects when limit is exceeded.
 */
export async function assertPlanLimit(
  tenantId: ObjectId,
  resource: keyof PlanLimits,
): Promise<void> {
  const { plan } = await getTenantSubscription(tenantId);
  const limit = plan.limits[resource];

  // -1 indicates unlimited
  if (limit === -1) return;

  const db = await tenantDb(tenantId);

  if (resource === "products") {
    const count = await db.products.countDocuments({ status: { $ne: "archived" } });
    if (count >= limit) {
      throw Errors.planLimit(
        `Your store has reached the limit of ${limit} products on the ${plan.name} plan. Please upgrade your plan to add more products.`,
      );
    }
  } else if (resource === "staff") {
    const count = await db.memberships.countDocuments({ status: { $in: ["active", "invited"] } });
    if (count >= limit) {
      throw Errors.planLimit(
        `Your store has reached the limit of ${limit} staff accounts on the ${plan.name} plan.`,
      );
    }
  }
}

export async function hasFeatureEntitlement(
  tenantId: ObjectId,
  feature: keyof PlanFeatures,
): Promise<boolean> {
  const { plan } = await getTenantSubscription(tenantId);
  return plan.features[feature] ?? false;
}
