import { requirePlatformStaff } from "@/lib/auth/context";
import { platformCollection } from "@/lib/db/collections";
import { toggleFeatureFlagAction } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { FeatureFlagDoc } from "@/lib/db/types";

const SYSTEM_DEFAULT_FLAGS: Array<{ key: string; description: string; defaultEnabled: boolean }> = [
  {
    key: "mock_gateway_enabled",
    description: "Allow merchants to use StoreForge Mock Gateway for checkout testing in non-production environments",
    defaultEnabled: true,
  },
  {
    key: "custom_domains_enabled",
    description: "Permit verified custom apex/subdomain routing for eligible tenant organizations",
    defaultEnabled: true,
  },
  {
    key: "realtime_inventory_sweep",
    description: "Automated cron sweep releasing uncompleted cart reservations older than 30 minutes",
    defaultEnabled: true,
  },
  {
    key: "allow_store_registration",
    description: "Public self-service merchant signup and automated tenant database provisioning",
    defaultEnabled: true,
  },
  {
    key: "platform_maintenance_mode",
    description: "Read-only maintenance window mode across all non-super-admin storefronts and dashboards",
    defaultEnabled: false,
  },
];

export default async function PlatformFlagsPage() {
  await requirePlatformStaff("platform:feature_flags");

  const flagsCol = await platformCollection("featureFlags");
  const storedFlags = await flagsCol.find({}).toArray();
  const storedMap = new Map<string, FeatureFlagDoc>(storedFlags.map((f) => [f._id, f]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Feature Flags & Kill Switches</h1>
        <p className="text-sm text-slate-500 mt-1">
          Dynamic runtime toggles and system controls across all StoreForge micro-features and integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {SYSTEM_DEFAULT_FLAGS.map((flag) => {
          const stored = storedMap.get(flag.key);
          const isEnabled = stored ? stored.enabled : flag.defaultEnabled;

          return (
            <Card key={flag.key} className="overflow-hidden border-slate-200">
              <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900">{flag.key}</span>
                    <Badge variant={isEnabled ? "success" : "neutral"}>
                      {isEnabled ? "ENABLED" : "DISABLED"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{flag.description}</p>
                  {stored?.updatedAt && (
                    <p className="text-[11px] text-slate-400">
                      Last modified: {new Date(stored.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await toggleFeatureFlagAction(formData);
                  }}
                >
                  <input type="hidden" name="key" value={flag.key} />
                  <input type="hidden" name="description" value={flag.description} />
                  <input type="hidden" name="enabled" value={isEnabled ? "false" : "true"} />

                  <Button
                    type="submit"
                    variant={isEnabled ? "outline" : "primary"}
                    size="sm"
                    className={
                      isEnabled
                        ? "text-rose-600 border-rose-300 hover:bg-rose-50"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }
                  >
                    {isEnabled ? (
                      <span className="flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> Disable Flag
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Enable Flag
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
