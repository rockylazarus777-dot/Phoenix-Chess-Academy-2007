import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/actions/auth";
import { CoachPortalSidebarNav } from "@/components/portal/coach/CoachPortalSidebarNav";
import { CoachPortalMobileNav } from "@/components/portal/coach/CoachPortalMobileNav";

interface CoachPortalShellProps {
  /** From the authenticated `profiles` row — always present once `requireRole()` has succeeded. */
  displayName: string | null;
  children: React.ReactNode;
}

/**
 * Real Phoenix Chess Academy coach portal shell (replaces the Phase 9
 * ProtectedShell placeholder for /coach only — student/parent/admin
 * shells are unaffected). Mirrors the Student and Parent Portal shells'
 * structure (desktop sidebar + topbar + main; mobile compact topbar +
 * accessible drawer) but only ever shows the coach's own name — no
 * phone/email/WhatsApp/specializations/assigned batch names appear in
 * the global shell.
 */
export function CoachPortalShell({ displayName, children }: CoachPortalShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#coach-portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <CoachPortalMobileNav />
            <Logo height={28} />
            <span className="hidden text-body-sm text-muted-foreground sm:inline">Coach Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-body-sm text-foreground sm:inline">{displayName ?? "Coach Portal"}</span>
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
          <CoachPortalSidebarNav />
        </aside>

        <main id="coach-portal-main-content" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
