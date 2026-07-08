import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/actions/auth";
import { ParentPortalSidebarNav } from "@/components/portal/parent/ParentPortalSidebarNav";
import { ParentPortalMobileNav } from "@/components/portal/parent/ParentPortalMobileNav";

interface ParentPortalShellProps {
  /** From the authenticated `profiles` row — always present once `requireRole()` has succeeded. */
  displayName: string | null;
  children: React.ReactNode;
}

/**
 * Real Phoenix Chess Academy parent portal shell (replaces the Phase 9
 * ProtectedShell placeholder for /parent only — student/coach/admin
 * shells are unaffected). Mirrors
 * `src/components/portal/student/StudentPortalShell.tsx`'s structure
 * (desktop sidebar + topbar + main; mobile compact topbar + accessible
 * drawer) but only ever shows the parent's own name — per Phase 12's
 * "Parent Header Identity" requirement, no phone/email/WhatsApp/linked
 * student names appear in the global shell.
 */
export function ParentPortalShell({ displayName, children }: ParentPortalShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#parent-portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <ParentPortalMobileNav />
            <Logo height={28} />
            <span className="hidden text-body-sm text-muted-foreground sm:inline">Parent Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-body-sm text-foreground sm:inline">{displayName ?? "Parent Portal"}</span>
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
          <ParentPortalSidebarNav />
        </aside>

        <main id="parent-portal-main-content" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
