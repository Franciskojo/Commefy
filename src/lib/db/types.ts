import type { ObjectId } from "mongodb";
import type { CurrencyCode } from "@/lib/money";

/**
 * Document shapes for every collection. See docs/database.md for indexes, validation and
 * retention rules. All tenant-owned documents carry `tenantId: ObjectId`.
 */

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantOwned {
  tenantId: ObjectId;
}

// ───────────────────────────── Platform-level ─────────────────────────────

export type TenantStatus = "pending" | "active" | "suspended" | "deleted";

export interface TenantDoc extends Timestamps {
  _id: ObjectId;
  slug: string;
  name: string;
  status: TenantStatus;
  ownerUserId: ObjectId;
  suspendedReason?: string;
  suspendedAt?: Date;
  deletedAt?: Date;
  featureFlags?: Record<string, boolean>;
}

export type PlatformRole = "super_admin" | "platform_support";

export interface UserDoc extends Timestamps {
  _id: ObjectId;
  email: string; // normalised lowercase
  name: string;
  passwordHash: string;
  emailVerifiedAt?: Date;
  platformRole?: PlatformRole;
  status: "active" | "disabled";
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  mfa?: {
    enabled: boolean;
    secretEnc?: EncryptedValue; // encrypted TOTP secret
    pendingSecretEnc?: EncryptedValue;
    recoveryCodeHashes: string[];
    enabledAt?: Date;
  };
}

export type TenantRole = "owner" | "manager" | "catalog_manager" | "order_manager" | "support";

export interface MembershipDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  userId?: ObjectId; // absent while invitation is pending for a non-registered email
  invitedEmail?: string;
  role: TenantRole;
  status: "invited" | "active" | "revoked";
  invitedBy?: ObjectId;
  acceptedAt?: Date;
  revokedAt?: Date;
}

export type SessionSubject = "user" | "customer";

export interface SessionDoc {
  _id: string; // sha256(token) hex
  subject: SessionSubject;
  userId?: ObjectId;
  customerId?: ObjectId;
  tenantId?: ObjectId; // required for customer sessions
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date; // idle expiry (sliding)
  absoluteExpiresAt: Date;
  mfaPending: boolean;
  reauthAt?: Date;
  userAgent?: string;
  ipHash?: string;
}

export type AuthTokenType = "email_verify" | "password_reset" | "invite" | "customer_email_verify" | "customer_password_reset";

export interface AuthTokenDoc {
  _id: string; // sha256(token)
  type: AuthTokenType;
  userId?: ObjectId;
  customerId?: ObjectId;
  tenantId?: ObjectId;
  membershipId?: ObjectId;
  email?: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

export interface EncryptedValue {
  v: 1;
  kid: string;
  iv: string; // base64
  tag: string; // base64
  ct: string; // base64
}

export interface PlanLimits {
  products: number; // -1 = unlimited
  staff: number;
  ordersPerMonth: number;
}

export interface PlanFeatures {
  customDomain: boolean;
  advancedAnalytics: boolean;
  discounts: boolean;
  removeBranding: boolean;
}

export interface SubscriptionPlanDoc extends Timestamps {
  _id: string; // stable code: "free" | "starter" | "pro" | ...
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: CurrencyCode;
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
  active: boolean;
  sortOrder: number;
  providerPriceIds?: { monthly?: string; annual?: string };
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  planId: string;
  status: SubscriptionStatus;
  interval: "month" | "year";
  provider: "manual" | "stripe";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  graceUntil?: Date;
  pendingPlanId?: string; // scheduled downgrade
  providerCustomerId?: string;
  providerSubscriptionId?: string;
}

export interface InvoiceDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  subscriptionId: ObjectId;
  number: string;
  planId: string;
  amount: number;
  currency: CurrencyCode;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  periodStart: Date;
  periodEnd: Date;
  provider: "manual" | "stripe";
  providerInvoiceId?: string;
  test: boolean;
  paidAt?: Date;
}

export interface CustomDomainDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  hostname: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  verifiedAt?: Date;
  lastCheckedAt?: Date;
  lastError?: string;
}

export type AuditCategory = "security" | "admin" | "commerce" | "platform" | "billing";

export interface AuditLogDoc {
  _id: ObjectId;
  tenantId?: ObjectId;
  category: AuditCategory;
  action: string;
  outcome: "success" | "failure" | "denied";
  actor: { type: "user" | "customer" | "system" | "anonymous"; id?: string; email?: string };
  target?: { type: string; id?: string };
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipHash?: string;
  createdAt: Date;
}

export interface WebhookEventDoc {
  _id: ObjectId;
  provider: "paystack" | "stripe" | "mock" | "stripe_billing";
  scope: "store" | "billing";
  tenantId?: ObjectId;
  eventId: string;
  type: string;
  status: "processing" | "processed" | "failed" | "ignored";
  attempts: number;
  error?: string;
  payloadDigest: string;
  receivedAt: Date;
  processedAt?: Date;
}

export interface IdempotencyRecordDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  scope: string;
  key: string;
  requestHash: string;
  status: "in_progress" | "completed";
  response?: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

export type JobType = "email.send" | "orders.expire_reservations" | "media.cleanup" | "subscriptions.sweep";

export interface NotificationJobDoc {
  _id: ObjectId;
  type: JobType;
  tenantId?: ObjectId;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "succeeded" | "dead";
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedUntil?: Date;
  lastError?: string;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagDoc extends Timestamps {
  _id: string;
  description: string;
  enabled: boolean;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface DevEmailDoc {
  _id: ObjectId;
  to: string;
  subject: string;
  text: string;
  html: string;
  createdAt: Date;
}

// ───────────────────────────── Tenant-owned ─────────────────────────────

export interface StoreSettingsDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  storeName: string;
  tagline?: string;
  currency: CurrencyCode;
  locale: string;
  branding: { primaryColor: string; accentColor: string; logoUrl?: string; heroImageUrl?: string };
  contact: { email?: string; phone?: string; address?: string };
  policies: { about: string; privacy: string; terms: string; shippingReturns: string };
  seo: { title?: string; description?: string };
  checkout: { allowGuest: boolean; reservationMinutes: number };
  inventory: { allowBackorders: boolean; lowStockThreshold: number };
  shipping: { zones: ShippingZone[] };
  tax: { pricesIncludeTax: boolean; rules: TaxRule[] };
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[]; // ISO-3166 alpha-2, "*" = rest of world
  methods: ShippingMethod[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  rate: number; // minor units
  freeOver?: number; // minor units subtotal threshold
  minDays?: number;
  maxDays?: number;
}

export interface TaxRule {
  id: string;
  name: string;
  country: string; // ISO alpha-2 or "*"
  region?: string;
  rateBps: number;
  appliesToShipping: boolean;
}

export type PaymentProviderName = "mock" | "paystack" | "stripe";

export interface PaymentConfigDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  provider: PaymentProviderName;
  mode: "test" | "live";
  publicKey?: string;
  secretKeyEnc?: EncryptedValue;
  webhookSecretEnc?: EncryptedValue;
  updatedBy: ObjectId;
}

export interface ProductImage {
  url: string;
  alt: string;
  mediaId?: ObjectId;
}

export interface ProductVariant {
  _id: ObjectId;
  sku: string;
  title: string;
  options: Record<string, string>;
  price: number;
  salePrice?: number;
}

export interface ProductDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  name: string;
  slug: string;
  description: string;
  brand?: string;
  status: "draft" | "active" | "archived";
  categoryIds: ObjectId[];
  tags: string[];
  images: ProductImage[];
  options: { name: string; values: string[] }[];
  variants: ProductVariant[];
  featured: boolean;
  seo: { title?: string; description?: string };
  priceMin: number; // denormalised for sorting
  ratingAvg: number; // x100 integer (e.g. 450 = 4.5)
  ratingCount: number;
  salesCount: number;
  publishedAt?: Date;
  deletedAt?: Date;
}

export interface CategoryDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  name: string;
  slug: string;
  description?: string;
  parentId?: ObjectId;
  sortOrder: number;
  imageUrl?: string;
}

export interface InventoryDoc extends TenantOwned {
  _id: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  sku: string;
  onHand: number;
  reserved: number;
  updatedAt: Date;
}

export type StockMovementReason =
  | "initial"
  | "adjustment"
  | "order_reserved"
  | "order_released"
  | "order_committed"
  | "refund_restock";

export interface StockMovementDoc extends TenantOwned {
  _id: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  reason: StockMovementReason;
  deltaOnHand: number;
  deltaReserved: number;
  orderId?: ObjectId;
  actorUserId?: ObjectId;
  note?: string;
  createdAt: Date;
}

export interface CartItem {
  productId: ObjectId;
  variantId: ObjectId;
  quantity: number;
  addedAt: Date;
}

export interface CartDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  tokenHash?: string;
  customerId?: ObjectId;
  items: CartItem[];
  discountCode?: string;
  expiresAt: Date;
}

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  phone?: string;
}

export interface CustomerDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash?: string; // absent for guest-only customers
  emailVerifiedAt?: Date;
  status: "active" | "disabled";
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  wishlist: ObjectId[];
  marketingOptIn: boolean;
  ordersCount: number;
  totalSpent: number;
}

export interface AddressDoc extends Timestamps, TenantOwned, Address {
  _id: ObjectId;
  customerId: ObjectId;
  label?: string;
  isDefault: boolean;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "partially_refunded"
  | "refunded";

export interface OrderItemSnapshot {
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  variantTitle: string;
  sku: string;
  imageUrl?: string;
  unitPrice: number; // effective price at purchase
  regularPrice: number;
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface OrderDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  orderNumber: number;
  customerId?: ObjectId;
  email: string;
  status: OrderStatus;
  currency: CurrencyCode;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  refundedTotal: number;
  pricesIncludeTax: boolean;
  discount?: { code: string; type: DiscountType; value: number; discountId: ObjectId };
  shippingAddress: Address;
  shippingMethod: { id: string; name: string; amount: number };
  taxLines: { name: string; rateBps: number; amount: number }[];
  payment: { provider: PaymentProviderName; status: PaymentStatus; reference?: string; mode: "test" | "live" };
  reservation: { status: "held" | "committed" | "released"; expiresAt: Date };
  accessTokenHash: string;
  statusHistory: { from: OrderStatus | null; to: OrderStatus; at: Date; actor: string; reason?: string }[];
  notes: { at: Date; authorUserId: ObjectId; text: string }[];
  paymentIssue?: "paid_after_cancellation" | "amount_mismatch";
  cancelReason?: string;
  paidAt?: Date;
  cancelledAt?: Date;
}

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "refunded" | "partially_refunded";

export interface PaymentDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  orderId: ObjectId;
  provider: PaymentProviderName;
  mode: "test" | "live";
  reference: string;
  providerTransactionId?: string;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  refundedAmount: number;
  checkoutUrl?: string;
  failureReason?: string;
  verifiedAt?: Date;
}

export interface RefundDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  orderId: ObjectId;
  paymentId: ObjectId;
  amount: number;
  currency: CurrencyCode;
  reason: string;
  restock: boolean;
  status: "pending" | "succeeded" | "failed";
  providerRefundId?: string;
  idempotencyKey: string;
  actorUserId: ObjectId;
  failureReason?: string;
}

export interface ShipmentDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  orderId: ObjectId;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: "shipped" | "delivered";
  shippedAt: Date;
  deliveredAt?: Date;
  actorUserId: ObjectId;
}

export type DiscountType = "percentage" | "fixed" | "free_shipping";

export interface DiscountDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  code: string; // uppercase
  description?: string;
  type: DiscountType;
  value: number; // bps for percentage, minor units for fixed, 0 for free shipping
  minSubtotal: number;
  startsAt?: Date;
  endsAt?: Date;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  appliesTo: { type: "all" | "products" | "categories"; ids: ObjectId[] };
  active: boolean;
}

export interface ReviewDoc extends Timestamps, TenantOwned {
  _id: ObjectId;
  productId: ObjectId;
  customerId: ObjectId;
  orderId: ObjectId;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
}

export interface MediaDoc extends TenantOwned {
  _id: ObjectId;
  key: string;
  provider: "mongo" | "cloudinary";
  url: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  status: "pending" | "attached" | "deleted";
  createdBy: ObjectId;
  createdAt: Date;
}
