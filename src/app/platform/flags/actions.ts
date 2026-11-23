"use server";

import { requirePlatformStaff } from "@/lib/auth/context";
import { setFeatureFlag } from "@/features/platform/service";
import { revalidatePath } from "next/cache";

export async function toggleFeatureFlagAction(formData: FormData): Promise<void> {
  const platform = await requirePlatformStaff("platform:feature_flags");
  const key = formData.get("key") as string;
  const enabled = formData.get("enabled") === "true";
  const description = (formData.get("description") as string) || "System feature flag";

  if (!key) return;

  await setFeatureFlag({
    key,
    enabled,
    description,
    actorUserId: platform.user._id,
  });

  revalidatePath("/platform/flags");
}
