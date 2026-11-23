import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { TenantScopedCollection, TenantScopeViolation } from "@/lib/db/scoped";
import { hasTenantPermission, hasPlatformPermission } from "@/lib/auth/permissions";
import { canTransitionOrder, assertValidOrderTransition } from "@/features/orders/state-machine";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { addMinor, applyBps, allocateProportionally } from "@/lib/money";

describe("Cross-Tenant Isolation & Security Invariants", () => {
  const tenantAId = new ObjectId();
  const tenantBId = new ObjectId();

  // Mock underlying MongoDB Collection
  const mockCollection: any = {
    collectionName: "products",
    find: (filter: any) => ({ toArray: async () => [filter] }),
    findOne: async (filter: any) => filter,
    insertOne: async (doc: any) => ({ insertedId: doc._id }),
    updateOne: async (filter: any, update: any) => ({ matchedCount: 1, modifiedCount: 1 }),
    aggregate: (pipeline: any) => ({ toArray: async () => pipeline }),
  };

  const scopedA = new TenantScopedCollection(tenantAId, mockCollection);
  const scopedB = new TenantScopedCollection(tenantBId, mockCollection);

  describe("TenantScopedCollection Security Enforcement", () => {
    it("automatically restricts queries to the bound tenantId", () => {
      const scopedFilter = scopedA.scope({ categoryId: new ObjectId() } as any);
      expect((scopedFilter as any).tenantId.equals(tenantAId)).toBe(true);
    });

    it("throws TenantScopeViolation if a query attempts to query another tenant's data", () => {
      expect(() => {
        scopedA.scope({ tenantId: tenantBId } as any);
      }).toThrow(TenantScopeViolation);
    });

    it("refuses updates that attempt to modify tenantId (tenant boundary breakout)", () => {
      expect(() => {
        scopedA.updateOne(
          { _id: new ObjectId() } as any,
          { $set: { tenantId: tenantBId } } as any,
        );
      }).toThrow(TenantScopeViolation);
    });

    it("rejects pipeline updates ($lookup, $unionWith) that could leak cross-tenant collections", () => {
      expect(() => {
        scopedA.aggregate([
          {
            $lookup: {
              from: "tenants",
              localField: "tenantId",
              foreignField: "_id",
              as: "tenant",
            },
          },
        ]);
      }).toThrow(TenantScopeViolation);

      expect(() => {
        scopedA.aggregate([
          {
            $unionWith: {
              coll: "orders",
            },
          },
        ]);
      }).toThrow(TenantScopeViolation);
    });
  });

  describe("Role-Based Authorization & Least Privilege", () => {
    it("prevents catalog managers from accessing payment secrets or financial configuration", () => {
      expect(hasTenantPermission("catalog_manager", "payment_keys:manage")).toBe(false);
      expect(hasTenantPermission("catalog_manager", "billing:manage")).toBe(false);
      expect(hasTenantPermission("catalog_manager", "staff:invite")).toBe(false);
      expect(hasTenantPermission("catalog_manager", "product:create")).toBe(true);
      expect(hasTenantPermission("catalog_manager", "product:update")).toBe(true);
    });

    it("restricts store deletion, staff invitation, and payment management exclusively to owner/manager", () => {
      expect(hasTenantPermission("owner", "payment_keys:manage")).toBe(true);
      expect(hasTenantPermission("owner", "store:delete")).toBe(true);
      expect(hasTenantPermission("support", "payment_keys:manage")).toBe(false);
      expect(hasTenantPermission("support", "order:read")).toBe(true);
      expect(hasTenantPermission("support", "order:update")).toBe(false);
      expect(hasTenantPermission("support", "staff:invite")).toBe(false);
    });

    it("prohibits platform support staff from executing super-admin destructive actions", () => {
      expect(hasPlatformPermission("platform_support", "platform:tenant_manage")).toBe(false);
      expect(hasPlatformPermission("platform_support", "platform:tenant_read")).toBe(true);
      expect(hasPlatformPermission("super_admin", "platform:tenant_manage")).toBe(true);
    });
  });

  describe("Order State Machine & Concurrency Integrity", () => {
    it("allows valid forward state transitions and rejects illegal backwards transitions", () => {
      expect(canTransitionOrder("pending_payment", "paid")).toBe(true);
      expect(canTransitionOrder("paid", "processing")).toBe(true);
      expect(canTransitionOrder("processing", "shipped")).toBe(true);
      expect(canTransitionOrder("shipped", "delivered")).toBe(true);
      expect(canTransitionOrder("paid", "refunded")).toBe(true);

      // Illegal transitions
      expect(canTransitionOrder("delivered", "pending_payment")).toBe(false);
      expect(canTransitionOrder("refunded", "paid")).toBe(false);
      expect(canTransitionOrder("cancelled", "paid")).toBe(false);
    });

    it("assertValidOrderTransition throws when an invalid order transition is attempted", () => {
      expect(() => {
        assertValidOrderTransition("refunded", "paid");
      }).toThrow(/Invalid order status transition/);

      expect(() => {
        assertValidOrderTransition("delivered", "pending_payment");
      }).toThrow(/Invalid order status transition/);
    });
  });

  describe("Webhook Cryptographic Verification & Anti-Replay", () => {
    const rawPayload = JSON.stringify({ event: "charge.success", id: "evt_12345" });
    const secret = "test_webhook_hmac_secret_key_32_characters";
    const provider = new MockPaymentProvider();

    it("verifies authentic HMAC signatures computed with SHA-256", () => {
      const crypto = require("node:crypto");
      const sig256 = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      expect(provider.verifyWebhookSignature(rawPayload, sig256, secret)).toBe(true);
    });

    it("rejects tampered payloads or forged signatures in constant time", () => {
      const crypto = require("node:crypto");
      const sig = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");
      const tamperedPayload = JSON.stringify({ event: "charge.success", id: "evt_FORGED" });

      expect(provider.verifyWebhookSignature(tamperedPayload, sig, secret)).toBe(false);
      expect(provider.verifyWebhookSignature(rawPayload, "invalid_sig_hex", secret)).toBe(false);
    });
  });

  describe("Server-Authoritative Minor-Unit Financial Math & Discount Proportions", () => {
    it("calculates exact basis point percentages with round-half-up math and integer safety", () => {
      // 1000 bps = 10%
      const discount = applyBps(5000, 1000);
      expect(discount).toBe(500);

      // 825 bps = 8.25% tax on $100.00 (10000 minor units) -> 825 minor units
      const tax = applyBps(10000, 825);
      expect(tax).toBe(825);

      // Half-up rounding test: 1 cent * 50% = 0.5 cents -> rounds up to 1 cent
      expect(applyBps(1, 5000)).toBe(1);
    });

    it("allocates order-level discounts proportionally across lines without fractional penny drift", () => {
      // $10.00 total discount across lines with prices $30.00, $30.00, $40.00
      const allocated = allocateProportionally(1000, [3000, 3000, 4000]);
      expect(allocated).toEqual([300, 300, 400]);
      expect(allocated.reduce((a, b) => a + b, 0)).toBe(1000);

      // Uneven split: $1.00 (100 cents) across 3 equal lines of $10.00
      const uneven = allocateProportionally(100, [1000, 1000, 1000]);
      expect(uneven.reduce((a, b) => a + b, 0)).toBe(100);
      // Remainder must be distributed deterministically (34, 33, 33)
      expect(uneven).toEqual([34, 33, 33]);
    });
  });
});
