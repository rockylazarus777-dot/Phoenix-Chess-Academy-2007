import type { CoachStatus } from "@/lib/supabase/types";

export type CoachPortalAccessLevel = "FULL" | "READ_ONLY" | "DENIED";

/**
 * Centralized coach portal access decision — the single place
 * `coach_status` maps to what the portal renders. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Status Access Matrix".
 *
 * Phase 10's `public.coach_status` enum (supabase/migrations/
 * 0012_admin_operations_schema.sql) has only three values — ACTIVE,
 * INACTIVE, ARCHIVED — the same shape as `parent_status`. There is no
 * ON_HOLD/ALUMNI-equivalent status for coaches, so this matrix currently
 * never produces READ_ONLY. The three-way `CoachPortalAccessLevel` type
 * is kept anyway (matching the student/parent portals' shape) so a
 * future coach status addition doesn't force every caller to change its
 * type — this is not an invented status value, just a currently-unused
 * branch of an already-generic result type.
 *
 *   ACTIVE              -> FULL
 *   INACTIVE / ARCHIVED -> DENIED
 *
 * Do not scatter a second switch on `coach_status` anywhere else in the
 * app — every page reads this via the identity result returned by
 * `getCurrentCoach()`.
 */
export function getCoachPortalAccess(status: CoachStatus): CoachPortalAccessLevel {
  switch (status) {
    case "ACTIVE":
      return "FULL";
    case "INACTIVE":
    case "ARCHIVED":
      return "DENIED";
  }
}
