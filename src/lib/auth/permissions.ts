import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import type { Role } from "@/lib/auth/roles";
import type { AuthProfile } from "@/lib/auth/types";

/**
 * Admin permission foundation (Phase 10).
 *
 * Phase 9 already gates entry to `/admin` to STAFF/ADMIN/SUPER_ADMIN via
 * `requireRole()`. That is a ROUTE-level gate only — it says nothing
 * about which of those three roles may perform which MUTATION. This
 * file is the single, centralized answer to that question. No page or
 * Server Action re-derives its own STAFF/ADMIN/SUPER_ADMIN comparison —
 * everything calls `hasPermission()`/`requirePermission()` from here.
 *
 * Deliberately NOT a general-purpose RBAC framework: a flat
 * role -> permission-set lookup table is the entire implementation.
 */
export type AdminPermission =
  | "VIEW_STUDENTS"
  | "MANAGE_STUDENTS"
  | "VIEW_PARENTS"
  | "MANAGE_PARENTS"
  | "VIEW_COACHES"
  | "MANAGE_COACHES"
  | "VIEW_BATCHES"
  | "MANAGE_BATCHES"
  | "VIEW_SCHEDULES"
  | "MANAGE_SCHEDULES"
  | "VIEW_ENROLLMENTS"
  | "MANAGE_ENROLLMENTS"
  | "MANAGE_ACCOUNTS"
  | "MANAGE_ROLES"
  | "VIEW_AUDIT_LOG"
  | "VIEW_CERTIFICATES"
  | "MANAGE_CERTIFICATES"
  | "VIEW_ACHIEVEMENTS"
  | "MANAGE_ACHIEVEMENTS";

const STAFF_PERMISSIONS: AdminPermission[] = [
  // "Operational read access and limited student/parent operational
  // updates" — per spec, STAFF gets broad VIEW access plus the two
  // MANAGE permissions for day-to-day front-desk work (updating a
  // student's contact details, linking a parent), but not coach/batch/
  // schedule/enrollment/account/role management.
  "VIEW_STUDENTS",
  "MANAGE_STUDENTS",
  "VIEW_PARENTS",
  "MANAGE_PARENTS",
  "VIEW_COACHES",
  "VIEW_BATCHES",
  "VIEW_SCHEDULES",
  "VIEW_ENROLLMENTS",
];

const ADMIN_PERMISSIONS: AdminPermission[] = [
  ...STAFF_PERMISSIONS,
  "MANAGE_COACHES",
  "MANAGE_BATCHES",
  "MANAGE_SCHEDULES",
  "MANAGE_ENROLLMENTS",
  "MANAGE_ACCOUNTS",
  "VIEW_AUDIT_LOG",
  // Phase 17: certificates and achievements are official academy
  // records — mutation authority is kept centralized at the ADMIN tier,
  // the same tier already used for MANAGE_COACHES/MANAGE_BATCHES/
  // MANAGE_ACCOUNTS, and deliberately excluded from STAFF_PERMISSIONS.
  // See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only
  // Mutation Decision".
  "VIEW_CERTIFICATES",
  "MANAGE_CERTIFICATES",
  "VIEW_ACHIEVEMENTS",
  "MANAGE_ACHIEVEMENTS",
  // ADMIN does not get MANAGE_ROLES — see "Role Management" in
  // docs/ADMIN_OPERATIONS_ARCHITECTURE.md: privileged role assignment
  // (STAFF/ADMIN) is SUPER_ADMIN-only, and SUPER_ADMIN assignment is not
  // exposed in any Phase 10 UI regardless of permission.
];

const SUPER_ADMIN_PERMISSIONS: AdminPermission[] = [...ADMIN_PERMISSIONS, "MANAGE_ROLES"];

/**
 * The entire permission matrix. STUDENT/PARENT/COACH intentionally have
 * no entry (empty array) — they cannot reach `/admin` at all per Phase
 * 9's `requireRole()`, but `hasPermission()` is defined for every `Role`
 * so it can never throw on an unexpected value.
 */
export const ROLE_PERMISSIONS: Record<Role, AdminPermission[]> = {
  STUDENT: [],
  PARENT: [],
  COACH: [],
  STAFF: STAFF_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
};

export function hasPermission(role: Role, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Server-side permission gate for admin mutations and privileged reads.
 *
 * This is deliberately independent of, and in addition to,
 * `requireRole()` (Phase 9's route-level gate on the /admin layout).
 * Every admin Server Action and every admin-only query module calls
 * this itself — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Permission
 * Security": an unauthorized STAFF user manually invoking a Server
 * Action (bypassing the UI entirely, e.g. via devtools) must still be
 * denied, and layout-level role protection alone cannot catch that.
 *
 * Behavior:
 *  - No session / no valid active profile -> redirect via
 *    `requireRole()`'s own rules (same as any other protected route).
 *  - Valid profile but lacks the permission -> redirect to that role's
 *    own home (never an "access denied, you need X" page that reveals
 *    the permission model to the caller).
 *  - Otherwise returns the profile, so the caller doesn't need a second
 *    `getCurrentProfile()` call.
 */
export async function requirePermission(permission: AdminPermission): Promise<AuthProfile> {
  const profile = await requireRole(["STAFF", "ADMIN", "SUPER_ADMIN"]);

  if (!hasPermission(profile.role, permission)) {
    redirect("/admin");
  }

  return profile;
}
