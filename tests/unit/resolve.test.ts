import { describe, it, expect, beforeAll } from "vitest";
import { classifyHost } from "@/lib/tenant/resolve";
import { resetEnvCache } from "@/lib/env";

describe("Host Classification and Tenant Routing", () => {
  beforeAll(() => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.PLATFORM_ROOT_DOMAIN = "storeforge.test";
    process.env.MONGODB_URI = "mongodb://localhost:27017/storeforge_test";
    process.env.AUTH_SECRET = "super-secret-auth-key-at-least-32-chars-long";
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    resetEnvCache();
  });

  it("classifies root domain as platform", () => {
    expect(classifyHost("storeforge.test").type).toBe("platform");
    expect(classifyHost("localhost").type).toBe("platform");
  });

  it("classifies subdomains correctly", () => {
    const res = classifyHost("acme.storeforge.test");
    expect(res.type).toBe("subdomain");
    expect(res.subdomain).toBe("acme");
  });

  it("classifies external domains as custom domains", () => {
    const res = classifyHost("www.acmestore.com");
    expect(res.type).toBe("custom_domain");
    expect(res.host).toBe("www.acmestore.com");
  });

  it("handles ports in host headers gracefully", () => {
    const res = classifyHost("store-b.storeforge.test:3000");
    expect(res.type).toBe("subdomain");
    expect(res.subdomain).toBe("store-b");
  });
});
