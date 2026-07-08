import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/actions/auth";
import { ADMIN_NAV_ITEMS } from "@/config/adminNavigation";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthProfile } from "@/lib/auth/types";

interface AdminShellProps {
  profile: AuthProfile;
  children: React.ReactNode;
}

/**
 * Real Phoenix Chess Academy admin shell (replaces the Phase 9
 * ProtectedShell placeholder for /admin only — portal/parent/coach
 * still use ProtectedShell, since their Phase 10 scope is unchanged).
 *
 * Desktop: fixed left sidebar + topbar + main. Mobile: compact topbar
 * with a menu button that opens an accessible drawer (AdminMobileNav).
 * Nav items are filtered by the caller's permissions — UX only, not a
 * security boundary; see src/config/adminNavigation.ts.
 */
export function AdminShell({ profile, children }: AdminShellProps) {
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => hasPermission(profile.role, item.permission));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <AdminMobileNav items={visibleItems} contextLabel="Administration" />
            <Logo height={28} />
            <span className="hidden text-body-sm text-muted-foreground sm:inline">Administration</span>
          </div>
          <div className="flex items-center gap-4">
            {profile.fullName ? (
              <span className="hidden text-body-sm text-foreground sm:inline">{profile.fullName}</span>
            ) : null}
            <span className="hidden rounded-full border border-border-strong px-2 py-0.5 text-xs text-muted-foreground md:inline">
              {profile.role}
            </span>
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

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 shrink-0 border-r border-border p-4 lg:flex lg:flex-col">
          <AdminSidebarNav items={visibleItems} />
        </aside>

        <main id="admin-main-content" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
