import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { CoachPortalShell } from "@/components/portal/coach/CoachPortalShell";

/**
 * /coach — COACH only. `getCurrentCoach()` calls `requireRole()`
 * internally as its first step (see src/lib/coach/getCurrentCoach.ts),
 * so this layout keeps the same Phase 9 authorization boundary — no
 * session -> /login; no profile -> /login?error=PROFILE_MISSING;
 * inactive profile -> /login?error=ACCOUNT_UNAVAILABLE; wrong role ->
 * that role's own home. Any future Server Action or Route Handler
 * under /coach must still authorize independently — this layout does
 * not protect those.
 *
 * PHASE 13: replaces the generic ProtectedShell placeholder with the
 * real coach portal shell. The shell always renders (nav, logout)
 * regardless of whether coach-identity resolution reached `OK` — a
 * database-unavailable or not-linked coach still needs a way to
 * navigate/log out; each page decides whether to render its normal
 * content or a `CoachPortalState` based on the same
 * `getCurrentCoach()` result (memoized per-request, so calling it
 * again in the page costs no extra query).
 */
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentCoach();

  return <CoachPortalShell displayName={identity.profile.fullName}>{children}</CoachPortalShell>;
}
