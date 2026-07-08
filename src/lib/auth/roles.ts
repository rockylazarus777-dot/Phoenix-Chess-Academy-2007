/**
 * Single authoritative role architecture for the whole app — the role
 * names here match `public.user_role` in
 * supabase/migrations/0002_profiles_and_roles.sql exactly
 * (STUDENT/PARENT/COACH/STAFF/ADMIN/SUPER_ADMIN, all upper-case). Do not
 * introduce a second, differently-cased role type ("student", "Student")
 * anywhere — import `Role` from here.
 *
 * Every role-to-route decision in the app (login redirect, protected
 * layouts, wrong-role redirects) calls `getRoleHome()` below rather than
 * re-switching on role — so the mapping only ever needs to change in one
 * place.
 */
export type Role = "STUDENT" | "PARENT" | "COACH" | "STAFF" | "ADMIN" | "SUPER_ADMIN";

export const ROLES: readonly Role[] = ["STUDENT", "PARENT", "COACH", "STAFF", "ADMIN", "SUPER_ADMIN"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Each role's entry route. STAFF/ADMIN/SUPER_ADMIN all share /admin for
 * Phase 9 — a future phase may split STAFF into its own area if the
 * academy's staff/admin permission model diverges, but that is not
 * decided yet, so they are not artificially separated now.
 */
const ROLE_HOME: Record<Role, string> = {
  STUDENT: "/portal",
  PARENT: "/parent",
  COACH: "/coach",
  STAFF: "/admin",
  ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
};

export function getRoleHome(role: Role): string {
  return ROLE_HOME[role];
}

/** Roles allowed into each protected portal segment — the single source used by every protected layout. */
export const PORTAL_ALLOWED_ROLES: Record<"portal" | "parent" | "coach" | "admin", Role[]> = {
  portal: ["STUDENT"],
  parent: ["PARENT"],
  coach: ["COACH"],
  admin: ["STAFF", "ADMIN", "SUPER_ADMIN"],
};
