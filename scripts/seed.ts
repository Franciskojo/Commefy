import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { registerTenant } from "@/features/tenants/service";
import { createProduct } from "@/features/products/service";
import { adjustInventory } from "@/features/inventory/service";
import { registerCustomer } from "@/features/customers/service";
import { encryptSecret } from "@/lib/security/crypto";
import { tenantDb } from "@/lib/db/scoped";

export async function seedDemoStores(): Promise<void> {
  console.log("=========================================");
  console.log("   StoreForge Reference Data Seeding     ");
  console.log("=========================================");

  const db = await getDb();
  console.log(`Connected to database: ${db.databaseName}`);

  const tenantsCol = await platformCollection("tenants");

  // ==========================================
  // Store 1: Apex Gear (Technical Outdoor)
  // ==========================================
  console.log("\n[1/2] Seeding Demo Store: Apex Gear (apex-gear)...");
  let apexTenant = await tenantsCol.findOne({ slug: "apex-gear" });

  if (!apexTenant) {
    const reg = await registerTenant({
      storeName: "Apex Gear",
      desiredSlug: "apex-gear",
      ownerName: "Marcus Vance",
      ownerEmail: "marcus@apexgear.io",
      password: "Password123!",
      currency: "USD",
    });
    apexTenant = reg.tenant;
    console.log("  ✓ Provisioned tenant: Apex Gear");
  } else {
    console.log("  ✓ Apex Gear tenant already registered");
  }

  const apexDb = await tenantDb(apexTenant._id);

  // Configure Store Branding & Policies
  await apexDb.storeSettings.updateOne(
    {},
    {
      $set: {
        storeName: "Apex Gear",
        currency: "USD",
        locale: "en-US",
        branding: {
          primaryColor: "#2563eb",
          accentColor: "#06b6d4",
        },
        contact: {
          email: "support@apexgear.io",
          phone: "+1 (800) 555-APEX",
          address: "100 Alpine Way, Boulder, CO 80302",
        },
        policies: {
          about: "Apex Gear designs uncompromising backcountry equipment tested in alpine extremes.",
          privacy: "We respect your data and never sell personal information.",
          terms: "Standard commercial e-commerce terms apply to all transactions.",
          shippingReturns: "Free ground shipping on domestic orders over $50. Lifetime warranty against manufacturer defects.",
        },
        shipping: {
          zones: [
            {
              id: "us-domestic",
              name: "United States (Domestic)",
              countries: ["US"],
              methods: [
                { id: "ground", name: "Standard Ground (3-5 days)", rate: 750, freeOver: 5000, minDays: 3, maxDays: 5 },
                { id: "express", name: "Expedited Air (1-2 days)", rate: 1800, minDays: 1, maxDays: 2 },
              ],
            },
          ],
        },
        tax: {
          pricesIncludeTax: false,
          rules: [
            { id: "us-standard", name: "US Sales Tax Estimate", rateBps: 825, country: "US", appliesToShipping: false },
          ],
        },
      },
    },
  );

  // Setup Mock Gateway for Apex Gear
  const rawConfigs = await rawTenantCollection("paymentConfigs");
  await rawConfigs.updateOne(
    { tenantId: apexTenant._id },
    {
      $set: {
        provider: "mock",
        mode: "test",
        publicKey: "pk_test_apex_gear_mock_public",
        secretKeyEnc: encryptSecret("sk_test_apex_gear_mock_secret", `tenant:${apexTenant._id.toHexString()}:secretKey`),
        webhookSecretEnc: encryptSecret("whsec_apex_gear_mock_secret", `tenant:${apexTenant._id.toHexString()}:webhookSecret`),
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: new ObjectId(), createdAt: new Date() },
    },
    { upsert: true },
  );

  // Seed Apex Gear Categories
  const existingCategories = await apexDb.categories.find({}).toArray();
  let backpackCatId: ObjectId;
  let shelterCatId: ObjectId;

  if (existingCategories.length === 0) {
    backpackCatId = new ObjectId();
    shelterCatId = new ObjectId();
    await apexDb.categories.insertMany([
      { _id: backpackCatId, name: "Alpine Packs", slug: "alpine-packs", sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { _id: shelterCatId, name: "Tents & Shelters", slug: "tents-shelters", sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
    ]);
  } else {
    backpackCatId = existingCategories[0]._id;
    shelterCatId = existingCategories[1]?._id || existingCategories[0]._id;
  }

  // Seed Apex Gear Products
  const existingProducts = await apexDb.products.countDocuments({});
  if (existingProducts === 0) {
    const p1 = await createProduct({
      tenantId: apexTenant._id,
      name: "Apex Alpine 45L Pack",
      slug: "apex-alpine-45l-pack",
      description: "An ultra-durable alpine mountaineering pack crafted from Dyneema composite fabric with removable bivy foam and dual ice tool holders.",
      categoryIds: [backpackCatId],
      featured: true,
      tags: ["backpack", "alpine", "dyneema", "ultralight"],
      variants: [
        { title: "Regular (18-20in)", sku: "APX-45L-REG", price: 24900, initialStock: 35, options: { Size: "Regular (18-20in)" } },
        { title: "Large (20-22in)", sku: "APX-45L-LRG", price: 24900, initialStock: 20, options: { Size: "Large (20-22in)" } },
      ],
      actorUserId: apexTenant.ownerUserId,
    });
    console.log(`  ✓ Product seeded: ${p1.name}`);

    const p2 = await createProduct({
      tenantId: apexTenant._id,
      name: "Geodesic Storm 2P Four-Season Tent",
      slug: "geodesic-storm-2p-tent",
      description: "Geodesic expedition tent engineered to withstand 70mph winds and heavy alpine snow loads. DAC Featherlite NSL poles and silicone-treated fly.",
      categoryIds: [shelterCatId],
      featured: true,
      tags: ["tent", "four-season", "expedition"],
      variants: [
        { title: "Standard Exped", sku: "APX-GEO-STD", price: 49900, initialStock: 15, options: {} },
      ],
      actorUserId: apexTenant.ownerUserId,
    });
    console.log(`  ✓ Product seeded: ${p2.name}`);

    const p3 = await createProduct({
      tenantId: apexTenant._id,
      name: "Titanium Micro-Canister Stove",
      slug: "titanium-micro-canister-stove",
      description: "Weighing only 48 grams, this regulated titanium burner boils 500ml of glacial meltwater in 2 minutes and 15 seconds.",
      featured: true,
      tags: ["cooking", "titanium", "stove"],
      variants: [
        { title: "Default", sku: "APX-STV-DFLT", price: 6500, initialStock: 60, options: {} },
      ],
      actorUserId: apexTenant.ownerUserId,
    });
    console.log(`  ✓ Product seeded: ${p3.name}`);
  }

  // Seed Demo Customer for Apex Gear
  const existingCust = await apexDb.customers.findOne({ email: "customer@apexgear.io" });
  if (!existingCust) {
    await registerCustomer({
      tenantId: apexTenant._id,
      name: "Taylor Reed",
      email: "customer@apexgear.io",
      password: "CustomerPassword123!",
      marketingOptIn: true,
    });
    console.log("  ✓ Customer seeded: customer@apexgear.io (PW: CustomerPassword123!)");
  }

  // ==========================================
  // Store 2: Luxe Apparel (Minimalist Fashion)
  // ==========================================
  console.log("\n[2/2] Seeding Demo Store: Luxe Apparel (luxe-apparel)...");
  let luxeTenant = await tenantsCol.findOne({ slug: "luxe-apparel" });

  if (!luxeTenant) {
    const reg = await registerTenant({
      storeName: "Luxe Apparel",
      desiredSlug: "luxe-apparel",
      ownerName: "Helena Moreau",
      ownerEmail: "helena@luxeapparel.io",
      password: "Password123!",
      currency: "EUR",
    });
    luxeTenant = reg.tenant;
    console.log("  ✓ Provisioned tenant: Luxe Apparel");
  } else {
    console.log("  ✓ Luxe Apparel tenant already registered");
  }

  const luxeDb = await tenantDb(luxeTenant._id);

  // Configure Store Branding
  await luxeDb.storeSettings.updateOne(
    {},
    {
      $set: {
        storeName: "Luxe Apparel",
        currency: "EUR",
        locale: "en-GB",
        branding: {
          primaryColor: "#7c3aed",
          accentColor: "#f43f5e",
        },
        contact: {
          email: "concierge@luxeapparel.io",
        },
        policies: {
          about: "Luxe Apparel creates timeless wardrobe foundations from sustainably harvested noble fibers.",
          privacy: "Compliant with GDPR and modern consumer rights directives.",
          terms: "Full terms available during checkout.",
          shippingReturns: "Complimentary express courier delivery on orders over €150.",
        },
      },
    },
  );

  // Setup Mock Gateway for Luxe Apparel
  await rawConfigs.updateOne(
    { tenantId: luxeTenant._id },
    {
      $set: {
        provider: "mock",
        mode: "test",
        publicKey: "pk_test_luxe_mock_public",
        secretKeyEnc: encryptSecret("sk_test_luxe_mock_secret", `tenant:${luxeTenant._id.toHexString()}:secretKey`),
        webhookSecretEnc: encryptSecret("whsec_luxe_mock_secret", `tenant:${luxeTenant._id.toHexString()}:webhookSecret`),
        updatedAt: new Date(),
      },
      $setOnInsert: { _id: new ObjectId(), createdAt: new Date() },
    },
    { upsert: true },
  );

  const existingLuxeProducts = await luxeDb.products.countDocuments({});
  if (existingLuxeProducts === 0) {
    await createProduct({
      tenantId: luxeTenant._id,
      name: "Pure Cashmere Mockneck Sweater",
      slug: "cashmere-mockneck-sweater",
      description: "Spun from 100% two-ply Mongolian cashmere with ribbed cuffs and a relaxed architectural silhouette.",
      featured: true,
      tags: ["cashmere", "sweater", "autumn"],
      variants: [
        { title: "Ivory / Small", sku: "LX-CSH-IVR-S", price: 28500, initialStock: 12, options: { Color: "Ivory", Size: "S" } },
        { title: "Ivory / Medium", sku: "LX-CSH-IVR-M", price: 28500, initialStock: 18, options: { Color: "Ivory", Size: "M" } },
        { title: "Charcoal / Medium", sku: "LX-CSH-CHR-M", price: 28500, initialStock: 20, options: { Color: "Charcoal", Size: "M" } },
      ],
      actorUserId: luxeTenant.ownerUserId,
    });
    console.log("  ✓ Product seeded: Pure Cashmere Mockneck Sweater");

    await createProduct({
      tenantId: luxeTenant._id,
      name: "Hand-Stitched Full Grain Calfskin Tote",
      slug: "calfskin-tote-bag",
      description: "Vegetable-tanned Florentine leather tote featuring brass hardware and a suede-lined zip compartment.",
      featured: true,
      tags: ["leather", "bag", "handcrafted"],
      variants: [
        { title: "Saddle Tan", sku: "LX-BAG-TAN", price: 42000, initialStock: 10, options: {} },
      ],
      actorUserId: luxeTenant.ownerUserId,
    });
    console.log("  ✓ Product seeded: Hand-Stitched Full Grain Calfskin Tote");
  }

  console.log("\n=========================================");
  console.log("   Reference Stores Seeding Complete!    ");
  console.log("=========================================\n");
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDemoStores()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
