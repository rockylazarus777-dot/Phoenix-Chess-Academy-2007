import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isRole } from "@/lib/auth/roles";
import type { AuthProfile } from "@/lib/auth/types";

/**
 * Resolves the current user's Phoenix profile row. Returns `null` when:
 * there is no authenticated user, Supabase isn't configured, the
 * `profiles` row genuinely doesn't exist for this auth user, or the
 * stored role value doesn't match the known `Role` union.
 *
 * IMPORTANT: this function never invents a profile or a default role.
 * An authenticated Supabase Auth user with no matching `profiles` row
 * gets `null` here, not a synthesized STUDENT profile — see
 * docs/AUTH_ARCHITECTURE.md, "Profile Requirement".
 */
export async function getCurrentProfile(): Promise<AuthProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await getServerSupabaseClient();

  // NOTE ON `as never`/casts: same supabase-js generic-inference gap for
  // a hand-written (non-CLI-generated) Database type documented in
  // src/lib/actions/contact.ts and
  // src/app/api/internal/reporting/sync/route.ts — worked around at the
  // call site only. `profiles` genuinely has this shape in
  // supabase/migrations/0002_profiles_and_roles.sql; the cast is not a
  // relaxation of real type safety, just a workaround for the library's
  // own inference limitation with this file's Database type.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, active")
    .eq("id", user.id as never)
    .maybeSingle();

  if (error || !data) return null; // no profile row -> deny, never default to STUDENT

  const row = data as unknown as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    active: boolean;
  };

  if (!isRole(row.role)) return null; // defensive: an unrecognized role value never grants access

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    active: row.active,
  };
}
