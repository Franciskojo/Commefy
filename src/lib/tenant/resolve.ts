import "server-only";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { platformCollection } from "@/lib/db/collections";
import type { TenantDoc } from "@/lib/db/types";
import { Errors } from "@/lib/errors";

export interface HostClassification {
  type: "platform" | "subdomain" | "custom_domain";
  host: string;
  subdomain?: string;
}

export function classifyHost(rawHost: string): HostClassification {
  const env = getEnv();
  // Strip port from host for domain comparison unless root domain has a port
  const host = rawHost.toLowerCase().trim();
  const rootDomain = env.PLATFORM_ROOT_DOMAIN.toLowerCase().trim();
  const hostNoPort = host.split(":")[0];
  const rootNoPort = rootDomain.split(":")[0];

  if (
    host === rootDomain ||
    hostNoPort === rootNoPort ||
    hostNoPort === "localhost" ||
    hostNoPort === "127.0.0.1" ||
    hostNoPort.endsWith(".vercel.app")
  ) {
    return { type: "platform", host };
  }

  // Check if it's a subdomain of PLATFORM_ROOT_DOMAIN
  if (hostNoPort.endsWith(`.${rootNoPort}`)) {
    const subdomain = hostNoPort.slice(0, hostNoPort.length - rootNoPort.length - 1);
    if (subdomain && !subdomain.includes(".")) {
      return { type: "subdomain", host, subdomain };
    }
  }

  return { type: "custom_domain", host: hostNoPort };
}

// In-memory short-TTL cache for tenant resolution (60 seconds)
interface CachedTenant {
  tenant: TenantDoc | null;
  cachedAt: number;
}
const cache = new Map<string, CachedTenant>();
const TTL_MS = 60_000;

export function invalidateTenantCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Resolves the tenant for the incoming storefront request.
 * Never trusts a client-supplied tenantId!
 */
export async function resolveStorefrontTenant(explicitSlug?: string): Promise<TenantDoc> {
  // If an explicit slug is provided (e.g. for /store/[slug] platform hosted fallback URL)
  if (explicitSlug) {
    if (explicitSlug.startsWith("~")) {
      const customHost = explicitSlug.slice(1).toLowerCase();
      const customDomainsCol = await platformCollection("customDomains");
      const verifiedDomain = await customDomainsCol.findOne({
        hostname: customHost,
        status: "verified",
      });
      if (verifiedDomain) {
        const tenantsCol = await platformCollection("tenants");
        const tenant = await tenantsCol.findOne({ _id: verifiedDomain.tenantId });
        if (!tenant) throw Errors.notFound("Store not found");
        if (tenant.status === "suspended") {
          throw Errors.tenantUnavailable("This store has been suspended by the platform administrator");
        }
        if (tenant.status !== "active") {
          throw Errors.tenantUnavailable("This store is not currently active");
        }
        return tenant;
      }
      throw Errors.notFound(`Custom domain not verified or mapped: ${customHost}`);
    }

    const col = await platformCollection("tenants");
    const tenant = await col.findOne({ slug: explicitSlug.toLowerCase() });
    if (!tenant) throw Errors.notFound("Store not found");
    if (tenant.status === "suspended") {
      throw Errors.tenantUnavailable("This store has been suspended by the platform administrator");
    }
    if (tenant.status !== "active") {
      throw Errors.tenantUnavailable("This store is not currently active");
    }
    return tenant;
  }

  const headerList = await headers();
  const hostHeader = headerList.get("host") || "";
  const classification = classifyHost(hostHeader);

  const cacheKey = classification.host;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.cachedAt < TTL_MS) {
    if (!cached.tenant) throw Errors.notFound("Store not found");
    if (cached.tenant.status === "suspended") {
      throw Errors.tenantUnavailable("This store has been suspended");
    }
    return cached.tenant;
  }

  const tenantsCol = await platformCollection("tenants");
  let tenant: TenantDoc | null = null;

  if (classification.type === "subdomain" && classification.subdomain) {
    tenant = await tenantsCol.findOne({ slug: classification.subdomain });
  } else if (classification.type === "custom_domain") {
    const customDomainsCol = await platformCollection("customDomains");
    const verifiedDomain = await customDomainsCol.findOne({
      hostname: classification.host,
      status: "verified",
    });
    if (verifiedDomain) {
      tenant = await tenantsCol.findOne({ _id: verifiedDomain.tenantId });
    }
  }

  cache.set(cacheKey, { tenant, cachedAt: now });

  if (!tenant) throw Errors.notFound("Store not found");
  if (tenant.status === "suspended") {
    throw Errors.tenantUnavailable("This store has been suspended by the platform administrator");
  }
  if (tenant.status !== "active") {
    throw Errors.tenantUnavailable("This store is not currently active");
  }

  return tenant;
}
