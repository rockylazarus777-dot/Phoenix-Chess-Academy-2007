import "server-only";
import { cache } from "react";
import { requireRole } from "@/lib/auth/requireRole";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getParentPortalAccess, type ParentPortalAccessLevel } from "@/lib/parent/access";
import type { AuthProfile } from "@/lib/auth/types";
import type { ParentStatus } from "@/lib/supabase/types";

/**
 * Narrow, portal-facing parent identity — deliberately not the full
 * `parents` row. No `notes`, no `profile_id`, no `created_at`/
 * `updated_at`, no country/state/city (those belong on the profile page
 * only). See docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Portal Identity
 * Type".
 */
export interface ParentPortalIdentity {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  status: ParentStatus;
}

export type ParentIdentityResult =
  | { status: "OK"; profile: AuthProfile; parent: ParentPortalIdentity; access: ParentPortalAccessLevel }
  | { status: "DATABASE_UNAVAILABLE"; profile: AuthProfile }
  | { status: "NOT_LINKED"; profile: AuthProfile }
  | { status: "UNKNOWN"; profile: AuthProfile };

/**
 * THE authoritative parent identity resolver for the whole /parent
 * segment — mirrors `src/lib/portal/getCurrentStudent.ts`'s pattern
 * exactly, but is its own independent function: it does not import from
 * or wrap the student resolver, since a parent and a student are
 * different business records with different privacy boundaries.
 *
 * Flow: `requireRole(["PARENT"])` (redirects on no session / wrong role
 * / inactive profile — reuses Phase 9's layout-level check) -> query
 * `parents` where `profile_id = auth.uid()` using the authenticated
 * (anon-key, cookie-scoped) server client, never the service-role
 * client -> narrow the row into `ParentPortalIdentity`.
 *
 * A PARENT-role profile with no matching `parents` row (incomplete
 * provisioning or legacy data) resolves to `NOT_LINKED` — portal data
 * access is denied, and the UI shows a safe, generic "contact the
 * academy" message rather than any internal detail. There is no
 * fallback to matching by email or phone, and no default parent is ever
 * substituted.
 *
 * Wrapped in React's `cache()` for per-request (not global) memoization
 * — safe for the same reason documented for `getCurrentStudent()`: it
 * cannot leak one user's identity into another user's request.
 */
export const getCurrentParent = cache(async (): Promise<ParentIdentityResult> => {
  const profile = await requireRole(["PARENT"]);

  if (!isSupabaseConfigured()) {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("parents")
      .select("id, full_name, email, phone, whatsapp, status")
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
      full_name: string;
      email: string | null;
      phone: string;
      whatsapp: string | null;
      status: ParentStatus;
    };

    return {
      status: "OK",
      profile,
      parent: {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        whatsapp: row.whatsapp,
        status: row.status,
      },
      access: getParentPortalAccess(row.status),
    };
  } catch {
    return { status: "DATABASE_UNAVAILABLE", profile };
  }
});
