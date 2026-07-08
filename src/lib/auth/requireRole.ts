import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getRoleHome, type Role } from "@/lib/auth/roles";
import type { AuthProfile } from "@/lib/auth/types";

/**
 * Server-side role gate used by every protected layout
 * (src/app/portal/layout.tsx, parent/layout.tsx, coach/layout.tsx,
 * admin/layout.tsx). This is the authoritative authorization boundary
 * for those routes — see docs/AUTH_ARCHITECTURE.md, "Security
 * Boundaries" for why Server Actions/Route Handlers must still authorize
 * independently rather than relying on layout protection alone.
 *
 * Behavior, in order:
 *  1. No session at all -> redirect to plain `/login` (expected case).
 *  2. Session exists but no `profiles` row -> redirect to
 *     `/login?error=PROFILE_MISSING` (never grants access, never
 *     defaults to STUDENT).
 *  3. Profile exists but `active` is false -> redirect to
 *     `/login?error=ACCOUNT_UNAVAILABLE`.
 *  4. Profile is valid and active but its role isn't in `allowedRoles`
 *     -> redirect to that role's own home (e.g. a STUDENT hitting
 *     `/admin` lands on `/portal`), never an "access denied" page that
 *     states the required role.
 *  5. Otherwise, return the profile to the caller.
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthProfile> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?error=PROFILE_MISSING");
  }

  if (!profile.active) {
    redirect("/login?error=ACCOUNT_UNAVAILABLE");
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect(getRoleHome(profile.role));
  }

  return profile;
}
