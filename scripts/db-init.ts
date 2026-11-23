import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { platformCollection } from "@/lib/db/collections";
import { DEFAULT_PLANS } from "@/features/subscriptions/service";
import { hashPassword } from "@/lib/auth/password";
import { ObjectId } from "mongodb";
import type { UserDoc } from "@/lib/db/types";

export async function initDatabase(): Promise<void> {
  console.log("=========================================");
  console.log("   StoreForge Database Bootstrap & Init  ");
  console.log("=========================================");

  const db = await getDb();
  console.log(`Connected to database: ${db.databaseName}`);

  // 1. Ensure all collection indexes, validators, and constraints
  console.log("\n[1/4] Ensuring database indexes and collection schemas...");
  await ensureIndexes();
  console.log("✓ All indexes and schema validators initialized.");

  // 2. Seed Default Subscription Plans
  console.log("\n[2/4] Seeding SaaS subscription plans...");
  const plansCol = await platformCollection("subscriptionPlans");
  for (const plan of DEFAULT_PLANS) {
    await plansCol.updateOne(
      { _id: plan._id },
      { $set: plan },
      { upsert: true },
    );
    console.log(`  ✓ Plan synced: ${plan.name} (${plan._id})`);
  }

  // 3. Seed Default Feature Flags
  console.log("\n[3/4] Seeding default system feature flags...");
  const flagsCol = await platformCollection("featureFlags");
  const defaultFlags = [
    { _id: "mock_gateway_enabled", description: "Allow mock payment gateway in development", enabled: true },
    { _id: "custom_domains_enabled", description: "Permit custom domains for eligible tenants", enabled: true },
    { _id: "realtime_inventory_sweep", description: "Periodic release of expired reservations", enabled: true },
    { _id: "allow_store_registration", description: "Self-serve merchant store creation", enabled: true },
    { _id: "platform_maintenance_mode", description: "Global read-only maintenance window", enabled: false },
  ];

  for (const flag of defaultFlags) {
    await flagsCol.updateOne(
      { _id: flag._id },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { description: flag.description, enabled: flag.enabled, updatedAt: new Date() },
      },
      { upsert: true },
    );
    console.log(`  ✓ Flag synced: ${flag._id}`);
  }

  // 4. Seed Platform Super-Admin Account
  console.log("\n[4/4] Verifying platform super-admin account...");
  const usersCol = await platformCollection("users");
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@storeforge.io";
  const existingAdmin = await usersCol.findOne({ email: adminEmail });

  if (!existingAdmin) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "SuperSecretPassword123!";
    const passwordHash = await hashPassword(adminPassword);
    const now = new Date();

    const adminUser: UserDoc = {
      _id: new ObjectId(),
      email: adminEmail,
      name: "Platform Super Admin",
      passwordHash,
      status: "active",
      platformRole: "super_admin",
      failedLoginCount: 0,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await usersCol.insertOne(adminUser);
    console.log(`  ✓ Created initial Super Admin: ${adminEmail}`);
    console.log(`    Temporary Password: ${adminPassword}`);
  } else {
    console.log(`  ✓ Super Admin already exists: ${adminEmail}`);
  }

  console.log("\n=========================================");
  console.log("   Database Initialization Complete!     ");
  console.log("=========================================\n");
}

if (process.argv[1] && process.argv[1].endsWith("db-init.ts")) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Database initialization failed:", err);
      process.exit(1);
    });
}
