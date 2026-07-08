import type { AdminPermission } from "@/lib/auth/permissions";

/**
 * The ONLY admin nav items. Every `href` here resolves to a real route —
 * no placeholders for Payments, Tournaments, or Media (still future
 * phases; see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Admin Navigation").
 * Phase 17 adds "Certificates" and "Achievements" because the real
 * `/admin/certificates` and `/admin/achievements` routes now exist — see
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Navigation".
 *
 * `permission` is used only to decide whether a nav item is SHOWN — a
 * UX convenience so STAFF doesn't see links to actions they can't take.
 * It is not a security boundary: every route and every Server Action
 * independently calls `requirePermission()` regardless of what the nav
 * displays. See src/lib/auth/permissions.ts.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  permission: AdminPermission;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", permission: "VIEW_STUDENTS" },
  { href: "/admin/students", label: "Students", permission: "VIEW_STUDENTS" },
  { href: "/admin/parents", label: "Parents", permission: "VIEW_PARENTS" },
  { href: "/admin/coaches", label: "Coaches", permission: "VIEW_COACHES" },
  { href: "/admin/batches", label: "Batches", permission: "VIEW_BATCHES" },
  { href: "/admin/schedules", label: "Schedules", permission: "VIEW_SCHEDULES" },
  { href: "/admin/enrollments", label: "Enrollments", permission: "VIEW_ENROLLMENTS" },
  { href: "/admin/certificates", label: "Certificates", permission: "VIEW_CERTIFICATES" },
  { href: "/admin/achievements", label: "Achievements", permission: "VIEW_ACHIEVEMENTS" },
  { href: "/admin/accounts", label: "Accounts", permission: "MANAGE_ACCOUNTS" },
  { href: "/admin/audit-log", label: "Audit Log", permission: "VIEW_AUDIT_LOG" },
];
