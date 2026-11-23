"use server";

import { platformCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import { inviteStaffMember, removeStaffMember } from "@/features/staff/service";
import { parseObjectId } from "@/lib/ids";
import { toPublicError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import type { TenantRole } from "@/lib/db/types";

export async function inviteStaffAction(formData: FormData) {
  const tenantSlug = formData.get("tenantSlug") as string;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return { error: "Tenant not found" };

  try {
    const staff = await requireTenantStaff(tenant._id, "staff:invite");
    const email = formData.get("email") as string;
    const role = formData.get("role") as TenantRole;

    await inviteStaffMember({
      tenantId: tenant._id,
      invitedByUserId: staff.user._id,
      email,
      role,
    });

    revalidatePath(`/admin/${tenantSlug}/staff`);
    return { success: true };
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }
}

export async function removeStaffAction(formData: FormData) {
  const tenantSlug = formData.get("tenantSlug") as string;
  const membershipIdStr = formData.get("membershipId") as string;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return { error: "Tenant not found" };

  try {
    const staff = await requireTenantStaff(tenant._id, "staff:remove");
    await removeStaffMember({
      tenantId: tenant._id,
      actorUserId: staff.user._id,
      membershipId: parseObjectId(membershipIdStr),
    });

    revalidatePath(`/admin/${tenantSlug}/staff`);
    return { success: true };
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }
}
