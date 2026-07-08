import "server-only";
import { cache } from "react";
import { requireRole } from "@/lib/auth/requireRole";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCoachPortalAccess, type CoachPortalAccessLevel } from "@/lib/coach/access";
import type { AuthProfile } from "@/lib/auth/types";
import type { CoachStatus } from "@/lib/supabase/types";

/**
 * Narrow, portal-facing coach identity — deliberately not the full
 * `coaches` row. No `profile_id`, no `created_at`/`updated_at`, no
 * admin-only fields. See docs/COACH_PORTAL_ARCHITECTURE.md, "Coach
 * Portal Identity Type".
 */
export interface CoachPortalIdentity {
  id: string;
  coachCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  specializations: string[];
  status: CoachStatus;
}

export type CoachIdentityResult =
  | { status: "OK"; profile: AuthProfile; coach: CoachPortalIdentity; access: CoachPortalAccessLevel }
  | { status: "DATABASE_UNAVAILABLE"; profile: AuthProfile }
  | { status: "NOT_LINKED"; profile: AuthProfile }
  | { status: "UNKNOWN"; profile: AuthProfile };

/**
 * THE authoritative coach identity resolver for the whole /coach
 * segment — mirrors `src/lib/portal/getCurrentStudent.ts` and
 * `src/lib/parent/getCurrentParent.ts`'s pattern exactly, but is its
 * own independent function: it does not import from or wrap either,
 * since a coach is a different business record with a different
 * privacy boundary.
 *
 * Flow: `requireRole(["COACH"])` (redirects on no session / wrong role
 * / inactive profile — reuses Phase 9's layout-level check) -> query
 * `coaches` where `profile_id = auth.uid()` using the authenticated
 * (anon-key, cookie-scoped) server client, never the service-role
 * client -> narrow the row into `CoachPortalIdentity`.
 *
 * A COACH-role profile with no matching `coaches` row (incomplete
 * provisioning or legacy data) resolves to `NOT_LINKED` — portal data
 * access is denied, and the UI shows a safe, generic "contact the
 * academy" message rather than any internal detail. There is no
 * fallback to matching by email or phone, and no default coach is ever
 * substituted.
 *
 * Wrapped in React's `cache()` for per-request (not global) memoization
 * — safe for the same reason documented for `getCurrentStudent()`/
 * `getCurrentParent()`: it cannot leak one user's identity into another
 * user's request.
 */
export const getCurrentCoach = cache(async (): Promise<CoachIdentityResult> => {
  const profile = await requireRole(["COACH"]);

  if (!isSupabaseConfigured()) {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("coaches")
      .select("id, coach_code, full_name, email, phone, whatsapp, bio, specializations, status")
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
      coach_code: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      whatsapp: string | null;
      bio: string | null;
      specializations: string[];
      status: CoachStatus;
    };

    return {
      status: "OK",
      profile,
      coach: {
        id: row.id,
        coachCode: row.coach_code,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        bio: row.bio,
        specializations: row.specializations,
        status: row.status,
      },
      access: getCoachPortalAccess(row.status),
    };
  } catch {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }
});
