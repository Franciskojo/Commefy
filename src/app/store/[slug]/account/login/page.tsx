import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { getCurrentCustomer } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { LoginFormClient } from "./LoginFormClient";

export default async function CustomerLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);

  // If already logged in, redirect to account dashboard
  const customer = await getCurrentCustomer(tenant._id);
  if (customer) {
    redirect(`/store/${slug}/account`);
  }

  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";
  const storeName = settings?.storeName || tenant.name;

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <LoginFormClient slug={slug} storeName={storeName} primaryColor={primaryColor} />
    </div>
  );
}
