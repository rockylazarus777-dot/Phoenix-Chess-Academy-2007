import type { StudentStatus } from "@/lib/supabase/types";

/**
 * Centralized student portal access decision — the single place
 * `student_status` maps to what the portal renders. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student Status Access Matrix".
 *
 *   ACTIVE               -> FULL (Phase 11 has no mutations anyway, so
 *                           "full" just means the normal read views)
 *   ON_HOLD / ALUMNI      -> READ_ONLY (portal remains visible; pages may
 *                           show a neutral, respectful banner)
 *   INACTIVE / ARCHIVED   -> DENIED (portal data is not rendered)
 *
 * Do not scatter a second switch on `student_status` anywhere else in
 * the app — every page calls this function via the identity result
 * returned by `getCurrentStudent()`.
 */
export type StudentPortalAccessLevel = "FULL" | "READ_ONLY" | "DENIED";

export function getStudentPortalAccess(status: StudentStatus): StudentPortalAccessLevel {
  switch (status) {
    case "ACTIVE":
      return "FULL";
    case "ON_HOLD":
    case "ALUMNI":
      return "READ_ONLY";
    case "INACTIVE":
    case "ARCHIVED":
      return "DENIED";
  }
}
