import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { StudentPortalShell } from "@/components/portal/student/StudentPortalShell";

/**
 * /portal — STUDENT only. `getCurrentStudent()` calls `requireRole()`
 * internally as its first step (see src/lib/portal/getCurrentStudent.ts),
 * so this layout keeps the same Phase 9 authorization boundary — no
 * session -> /login; no profile -> /login?error=PROFILE_MISSING;
 * inactive profile -> /login?error=ACCOUNT_UNAVAILABLE; wrong role ->
 * that role's own home. Any future Server Action or Route Handler under
 * /portal must still authorize independently — this layout does not
 * protect those.
 *
 * PHASE 11: replaces the generic ProtectedShell placeholder with the
 * real student portal shell. The shell always renders (nav, logout)
 * regardless of whether student-identity resolution reached `OK` — a
 * database-unavailable or not-linked student still needs a way to
 * navigate/log out; each page decides whether to render its normal
 * content or a `StudentPortalState` based on the same
 * `getCurrentStudent()` result (memoized per-request, so calling it
 * again in the page costs no extra query).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentStudent();

  return (
    <StudentPortalShell
      displayName={identity.profile.fullName}
      studentCode={identity.status === "OK" ? identity.student.studentCode : null}
    >
      {children}
    </StudentPortalShell>
  );
}
