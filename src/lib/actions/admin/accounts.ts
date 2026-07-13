"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/config/site";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  provisionAccountSchema,
  changeStaffRoleSchema,
  type ChangeStaffRoleValues,
} from "@/lib/validation/admin/account";
import type { UserRole } from "@/lib/supabase/types";

type ProvisionableTable = "students" | "parents" | "coaches";

/**
 * Shared invite-and-link flow for the three business-record tables.
 *
 * Reconciliation strategy (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Account Provisioning Failure Cases"):
 *
 *  1. `auth.admin.inviteUserByEmail` and the Postgres writes below are NOT
 *     one atomic transaction — the Supabase Auth Admin API and Postgres
 *     cannot be composed into a single native transaction.
 *  2. If the invite call itself fails because the email already has an
 *     auth user (a distinct, recognizable error from Supabase), we do
 *     NOT retry automatically — a blind retry against "email exists"
 *     could attach the wrong business record to an existing auth user.
 *     We return a safe message asking the admin to check the Supabase
 *     Auth dashboard before deciding how to proceed.
 *  3. If the invite succeeds but the subsequent `profiles` insert or the
 *     business record's `profile_id` update fails, we do NOT report
 *     success — an auth user now exists with no usable Phoenix profile.
 *     We return `success: false` with a distinct message and log the
 *     event distinctly so it is discoverable for manual reconciliation
 *     (same manual-follow-up pattern as Phase 9's SUPER_ADMIN bootstrap).
 *     We never attempt an automatic second invite on retry, since that
 *     could create a duplicate auth user.
 *
 * `inviteUserByEmail`'s `redirectTo` explicitly targets
 * `/auth/callback?next=/accept-invite` — mirroring the same
 * `redirectTo`-into-`/auth/callback` pattern `requestPasswordReset()`
 * uses in src/lib/actions/auth.ts. Without this, Supabase falls back to
 * the bare Site URL, which has no code to handle the invite link at all.
 *
 * The inserted `profiles` row is `active: false`, not `true` — an
 * invited user's session (created the instant they exchange the invite
 * code) must not by itself satisfy `requireRole()`'s active check.
 * `activate_own_profile()` (SECURITY DEFINER RPC,
 * supabase/migrations/0029_profile_activation.sql) is the only path that
 * ever flips it to `true`, and only after the invited user actually
 * creates a password. See docs/AUTH_ARCHITECTURE.md, "Accept Invite
 * Architecture".
 */
async function provisionAccount(
  table: ProvisionableTable,
  role: UserRole,
  recordId: string,
): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_ACCOUNTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const parsed = provisionAccountSchema.safeParse({ recordId });
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  const auditEntityType = table === "students" ? "student" : table === "parents" ? "parent" : "coach";

  try {
    const supabase = getAdminSupabaseClient();

    const { data: record, error: fetchError } = await supabase
      .from(table)
      .select("id, full_name, email, phone, profile_id")
      .eq("id", parsed.data.recordId as never)
      .maybeSingle();

    if (fetchError) {
      logAdminEvent({ area: "accounts", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }
    if (!record) {
      return { success: false, message: getSafeAdminMessage("NOT_FOUND") };
    }

    const row = record as unknown as {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      profile_id: string | null;
    };

    if (row.profile_id) {
      return { success: false, message: getSafeAdminMessage("CONFLICT") };
    }
    if (!row.email) {
      return {
        success: false,
        message: "This record has no email on file. Add an email address before inviting a portal account.",
      };
    }

    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(row.email, {
      data: { full_name: row.full_name },
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/accept-invite")}`,
    });

    if (inviteError || !invited?.user) {
      logAdminEvent({ area: "accounts", code: "ACCOUNT_PROVISIONING_FAILED" });
      // Supabase returns a distinguishable "already registered" condition for
      // existing auth users. We deliberately do not attempt to look this up
      // and retry automatically — see function-level doc comment.
      return {
        success: false,
        message:
          "The invitation could not be sent. If this email already has a Phoenix account, check the Supabase Auth dashboard before retrying — no account was created or changed.",
      };
    }

    const authUserId = invited.user.id;

    // active: false — the invited user is not granted portal access
    // (requireRole()'s active check) until they actually create a
    // password. activate_own_profile() (SECURITY DEFINER RPC, called by
    // acceptInvite() only after supabase.auth.updateUser({ password })
    // succeeds) is the only path that ever flips this to true for an
    // invited account. See docs/AUTH_ARCHITECTURE.md, "Accept Invite
    // Architecture".
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUserId,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      role,
      active: false,
    } as never);

    if (profileError) {
      logAdminEvent({ area: "accounts", code: "ACCOUNT_PROVISIONING_FAILED" });
      return {
        success: false,
        message:
          "An invitation email was sent, but linking the Phoenix profile failed. The account is not yet usable — contact support to complete setup rather than sending another invite.",
      };
    }

    const { error: linkError } = await supabase
      .from(table)
      .update({ profile_id: authUserId } as never)
      .eq("id", row.id as never);

    if (linkError) {
      logAdminEvent({ area: "accounts", code: "ACCOUNT_PROVISIONING_FAILED" });
      return {
        success: false,
        message:
          "An invitation email was sent and a profile was created, but linking it to this record failed. Contact support to complete setup rather than sending another invite.",
      };
    }

    await recordAdminAudit({
      actor: profile,
      action: "ACCOUNT_INVITED",
      entityType: auditEntityType,
      entityId: row.id,
      summary: `Portal account invitation sent (${role}).`,
      metadata: { role },
    });

    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/${table}/${row.id}`);
    return { success: true, message: "Invitation sent." };
  } catch {
    logAdminEvent({ area: "accounts", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function provisionStudentAccount(studentId: string): Promise<AdminActionResult> {
  return provisionAccount("students", "STUDENT", studentId);
}

export async function provisionParentAccount(parentId: string): Promise<AdminActionResult> {
  return provisionAccount("parents", "PARENT", parentId);
}

export async function provisionCoachAccount(coachId: string): Promise<AdminActionResult> {
  return provisionAccount("coaches", "COACH", coachId);
}

async function setProfileActive(profileId: string, active: boolean): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_ACCOUNTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("profiles").update({ active } as never).eq("id", profileId as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: active ? "ACCOUNT_REACTIVATED" : "ACCOUNT_DEACTIVATED",
      entityType: "account",
      entityId: profileId,
      summary: active ? "Portal account reactivated." : "Portal account deactivated.",
    });

    revalidatePath("/admin/accounts");
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function deactivateAccount(profileId: string): Promise<AdminActionResult> {
  return setProfileActive(profileId, false);
}

export async function reactivateAccount(profileId: string): Promise<AdminActionResult> {
  return setProfileActive(profileId, true);
}

/**
 * Privileged role management — SUPER_ADMIN only, gated on MANAGE_ROLES.
 *
 * Deliberately restricted to STAFF <-> ADMIN changes:
 *  - `changeStaffRoleSchema` only accepts "STAFF" | "ADMIN" as the target
 *    role, so SUPER_ADMIN can never be assigned through this action.
 *  - The target profile's CURRENT role must already be STAFF or ADMIN —
 *    this action never touches a STUDENT/PARENT/COACH/SUPER_ADMIN row,
 *    so it cannot be used as a backdoor to promote a portal account into
 *    staff, nor to demote the existing SUPER_ADMIN.
 * See docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Privileged Role Management".
 */
export async function changeStaffRole(input: ChangeStaffRoleValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_ROLES");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const parsed = changeStaffRoleSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();

    const { data: target, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", parsed.data.profileId as never)
      .maybeSingle();

    if (fetchError) return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    if (!target) return { success: false, message: getSafeAdminMessage("NOT_FOUND") };

    const currentRole = (target as unknown as { role: UserRole }).role;
    if (currentRole !== "STAFF" && currentRole !== "ADMIN") {
      return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: parsed.data.role } as never)
      .eq("id", parsed.data.profileId as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "ROLE_CHANGED",
      entityType: "account",
      entityId: parsed.data.profileId,
      summary: `Role changed from ${currentRole} to ${parsed.data.role}.`,
      metadata: { role_from: currentRole, role_to: parsed.data.role },
    });

    revalidatePath("/admin/accounts");
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
