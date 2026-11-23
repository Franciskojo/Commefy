"use server";

import { requirePlatformStaff } from "@/lib/auth/context";
import { updateTenantStatus } from "@/features/platform/service";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { TenantStatus } from "@/lib/db/types";

export async function toggleTenantStatusAction(formData: FormData): Promise<void> {
  const platform = await requirePlatformStaff("platform:tenant_manage");
  const tenantIdStr = formData.get("tenantId") as string;
  const newStatus = formData.get("status") as TenantStatus;
  const reason = (formData.get("reason") as string)?.trim() || undefined;

  if (!tenantIdStr || !newStatus) return;

  await updateTenantStatus({
    tenantId: new ObjectId(tenantIdStr),
    status: newStatus,
    reason,
    actorUserId: platform.user._id,
  });

  revalidatePath("/platform/tenants");
  revalidatePath("/platform");
}
