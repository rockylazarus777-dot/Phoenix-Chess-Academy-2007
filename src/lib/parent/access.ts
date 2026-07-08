import type { ParentStatus } from "@/lib/supabase/types";

export type ParentPortalAccessLevel = "FULL" | "READ_ONLY" | "DENIED";

/**
 * Centralized parent portal access decision — the single place
 * `parent_status` maps to what the portal renders. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Status Access Matrix".
 *
 * Phase 10's `public.parent_status` enum (supabase/migrations/
 * 0012_admin_operations_schema.sql) has only three values — ACTIVE,
 * INACTIVE, ARCHIVED. There is no ON_HOLD/ALUMNI-equivalent status for
 * parents the way there is for students, so this matrix currently never
 * produces READ_ONLY. The three-way `ParentPortalAccessLevel` type is
 * kept anyway (matching the student portal's shape) so a future parent
 * status addition doesn't force every caller to change its type — this
 * is not an invented status value, just a currently-unused branch of an
 * already-generic result type.
 *
 *   ACTIVE              -> FULL
 *   INACTIVE / ARCHIVED -> DENIED
 *
 * Do not scatter a second switch on `parent_status` anywhere else in the
 * app — every page reads this via the identity result returned by
 * `getCurrentParent()`.
 */
export function getParentPortalAccess(status: ParentStatus): ParentPortalAccessLevel {
  switch (status) {
    case "ACTIVE":
      return "FULL";
    case "INACTIVE":
    case "ARCHIVED":
      return "DENIED";
  }
}
