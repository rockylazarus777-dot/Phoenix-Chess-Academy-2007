import "server-only";
import { cache } from "react";
import { requireRole } from "@/lib/auth/requireRole";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getStudentPortalAccess, type StudentPortalAccessLevel } from "@/lib/portal/access";
import type { AuthProfile } from "@/lib/auth/types";
import type { StudentStatus } from "@/lib/supabase/types";

/**
 * Narrow, portal-facing student identity — deliberately not the full
 * `students` row. No `notes`, no `address`, no `profile_id`, no
 * `created_at`/`updated_at`, no relationship data. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student Portal Identity Type".
 */
export interface StudentPortalIdentity {
  id: string;
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  currentLevel: string | null;
  status: StudentStatus;
  joinedOn: string | null;
  fideId: string | null;
  fideRating: number | null;
}

export type StudentIdentityResult =
  | { status: "OK"; profile: AuthProfile; student: StudentPortalIdentity; access: StudentPortalAccessLevel }
  | { status: "DATABASE_UNAVAILABLE"; profile: AuthProfile }
  | { status: "NOT_LINKED"; profile: AuthProfile }
  | { status: "UNKNOWN"; profile: AuthProfile };

/**
 * THE authoritative student identity resolver for the whole /portal
 * segment. Every page (and the layout, for shell display) calls this —
 * never a second, differently-shaped lookup.
 *
 * Flow: `requireRole(["STUDENT"])` (redirects on no session / wrong role
 * / inactive profile — this reuses Phase 9's layout-level check, safe to
 * call again) -> query `students` where `profile_id = auth.uid()` using
 * the authenticated (anon-key, cookie-scoped) server client, never the
 * service-role client -> narrow the row into `StudentPortalIdentity`.
 *
 * A STUDENT-role profile with no matching `students` row (provisioning
 * partially failed, or legacy data is incomplete) resolves to
 * `NOT_LINKED` — portal data access is denied, and the UI shows a safe,
 * generic "contact the academy" message (src/components/portal/student/
 * StudentPortalState.tsx) rather than any internal detail. There is no
 * fallback to matching by email, and no default student is ever
 * substituted.
 *
 * Wrapped in React's `cache()` so multiple calls within the same
 * request (layout + page, or a page plus a nested component) resolve
 * once — this is per-request memoization, not a global/shared cache, so
 * it cannot leak one user's identity into another user's request.
 */
export const getCurrentStudent = cache(async (): Promise<StudentIdentityResult> => {
  const profile = await requireRole(["STUDENT"]);

  if (!isSupabaseConfigured()) {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .select("id, student_code, full_name, email, phone, current_level, status, joined_on, fide_id, fide_rating")
      .eq("profile_id", profile.id as never)
      .maybeSingle();

    if (error) {
      return { status: "UNKNOWN", profile };
    }
    if (!data) {
      return { status: "NOT_LINKED", profile };
    }

    const row = data as unknown as {
      id: string;
      student_code: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      current_level: string | null;
      status: StudentStatus;
      joined_on: string | null;
      fide_id: string | null;
      fide_rating: number | null;
    };

    return {
      status: "OK",
      profile,
      student: {
        id: row.id,
        studentCode: row.student_code,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        currentLevel: row.current_level,
        status: row.status,
        joinedOn: row.joined_on,
        fideId: row.fide_id,
        fideRating: row.fide_rating,
      },
      access: getStudentPortalAccess(row.status),
    };
  } catch {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }
});
