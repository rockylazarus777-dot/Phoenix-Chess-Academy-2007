import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/actions/auth";
import { StudentPortalSidebarNav } from "@/components/portal/student/StudentPortalSidebarNav";
import { StudentPortalMobileNav } from "@/components/portal/student/StudentPortalMobileNav";

interface StudentPortalShellProps {
  /** From the authenticated `profiles` row — always present once `requireRole()` has succeeded. */
  displayName: string | null;
  /** From the linked `students` row — null when identity resolution hasn't reached OK yet (database unavailable / not linked). Never shows "undefined". */
  studentCode: string | null;
  children: React.ReactNode;
}

/**
 * Real Phoenix Chess Academy student portal shell (replaces the Phase 9
 * ProtectedShell placeholder for /portal only — parent/coach/admin
 * shells are unaffected). Desktop: sidebar + topbar + main. Mobile:
 * compact topbar with an accessible drawer
 * (StudentPortalMobileNav). The shell always renders regardless of
 * whether student-identity resolution succeeded — a database-unavailable
 * or not-linked state still needs navigation and a way to log out; the
 * per-page content area is what renders the actual error state (see
 * StudentPortalState).
 */
export function StudentPortalShell({ displayName, studentCode, children }: StudentPortalShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#student-portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <StudentPortalMobileNav />
            <Logo height={28} />
            <span className="hidden text-body-sm text-muted-foreground sm:inline">Student Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-body-sm text-foreground sm:inline">{displayName ?? "Student Portal"}</span>
            {studentCode ? (
              <span className="hidden rounded-full border border-border-strong px-2 py-0.5 text-xs text-muted-foreground md:inline">
                {studentCode}
              </span>
            ) : null}
            <Link href="/" className="text-body-sm text-muted-foreground hover:text-foreground hover:underline">
              Website
            </Link>
            <form action={logout}>
              <button type="submit" className="text-body-sm text-primary-text hover:underline">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 border-r border-border p-4 lg:flex lg:flex-col">
          <StudentPortalSidebarNav />
        </aside>

        <main id="student-portal-main-content" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
