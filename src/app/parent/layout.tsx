import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { ParentPortalShell } from "@/components/portal/parent/ParentPortalShell";

/**
 * /parent — PARENT only. `getCurrentParent()` calls `requireRole()`
 * internally as its first step (see
 * src/lib/parent/getCurrentParent.ts), so this layout keeps the same
 * Phase 9 authorization boundary — no session -> /login; no profile ->
 * /login?error=PROFILE_MISSING; inactive profile ->
 * /login?error=ACCOUNT_UNAVAILABLE; wrong role -> that role's own home.
 * Any future Server Action or Route Handler under /parent must still
 * authorize independently — this layout does not protect those.
 *
 * PHASE 12: replaces the generic ProtectedShell placeholder with the
 * real parent portal shell. The shell always renders (nav, logout)
 * regardless of whether parent-identity resolution reached `OK` — a
 * database-unavailable or not-linked parent still needs a way to
 * navigate/log out; each page decides whether to render its normal
 * content or a `ParentPortalState` based on the same
 * `getCurrentParent()` result (memoized per-request, so calling it
 * again in the page costs no extra query).
 */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentParent();

  return <ParentPortalShell displayName={identity.profile.fullName}>{children}</ParentPortalShell>;
}
