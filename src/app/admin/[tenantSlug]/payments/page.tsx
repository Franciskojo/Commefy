import React from "react";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { savePaymentConfigAction } from "./actions";
import { ShieldCheck, Save, CreditCard } from "lucide-react";

export default async function TenantAdminPaymentsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const rawConfigs = await rawTenantCollection("paymentConfigs");
  const config = await rawConfigs.findOne({ tenantId: tenant._id });

  const hasSecretConfigured = !!config?.secretKeyEnc;
  const hasWebhookConfigured = !!config?.webhookSecretEnc;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Payment Gateway</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure verified payment processing for your storefront. Keys are encrypted at rest with AES-256-GCM.
        </p>
      </div>

      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3 text-indigo-900 text-sm">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
        <span>
          <strong>Security Note:</strong> Client browser code never receives secret keys. Webhook events are cryptographically signature-verified.
        </span>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await savePaymentConfigAction(formData);
        }}
      >
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>Provider Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Primary Payment Processor *
              </label>
              <select
                name="provider"
                defaultValue={config?.provider || "mock"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="mock">StoreForge Mock Gateway (Development / Test)</option>
                <option value="paystack">Paystack (Africa & International)</option>
                <option value="stripe">Stripe Checkout (Global)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Environment Mode *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="test"
                    defaultChecked={!config || config.mode === "test"}
                  />
                  <span>Test Mode (Sandbox)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="live"
                    defaultChecked={config?.mode === "live"}
                  />
                  <span>Live Production Mode</span>
                </label>
              </div>
            </div>
          </CardContent>

          <CardHeader className="pt-0">
            <CardTitle>API Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Public Key (Client-Safe)"
              name="publicKey"
              defaultValue={config?.publicKey || ""}
              placeholder="e.g. pk_test_... or pk_live_..."
            />

            <div>
              <Input
                label="Secret Key (Encrypted at rest)"
                name="secretKey"
                type="password"
                placeholder={hasSecretConfigured ? "••••••••••••••••••••" : "e.g. sk_test_... or sk_live_..."}
                helperText={
                  hasSecretConfigured
                    ? "A secret key is already configured. Leave blank to keep existing key, or enter a new key to update."
                    : "Enter your provider's secret key."
                }
              />
              {hasSecretConfigured && (
                <div className="mt-1">
                  <Badge variant="success">Configured</Badge>
                </div>
              )}
            </div>

            <div>
              <Input
                label="Webhook Signing Secret (Encrypted at rest)"
                name="webhookSecret"
                type="password"
                placeholder={hasWebhookConfigured ? "••••••••••••••••••••" : "e.g. whsec_..."}
                helperText={
                  hasWebhookConfigured
                    ? "Webhook secret configured. Leave blank to keep existing secret."
                    : "Required to cryptographically verify incoming asynchronous payment notifications."
                }
              />
              {hasWebhookConfigured && (
                <div className="mt-1">
                  <Badge variant="success">Configured</Badge>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit">
                <Save className="w-4 h-4 mr-1.5" /> Save Gateway Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
