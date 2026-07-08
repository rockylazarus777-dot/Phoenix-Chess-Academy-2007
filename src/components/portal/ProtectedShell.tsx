import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { logout } from "@/lib/actions/auth";
import type { AuthProfile } from "@/lib/auth/types";

interface ProtectedShellProps {
  profile: AuthProfile;
  /** Human-readable portal context, e.g. "Student Portal", "Administration". */
  contextLabel: string;
  children: React.ReactNode;
}

/**
 * Minimal shared chrome for the four protected portal segments (portal,
 * parent, coach, admin). Deliberately does not build a sidebar or any
 * navigation to features that don't exist yet (Attendance, Progress,
 * Certificates, Students, Payments, Reports) — see
 * docs/AUTH_ARCHITECTURE.md, "Portal Placeholder Rule". Logout is a
 * plain server-rendered form posting to the `logout` Server Action —
 * no client JS required for this shell.
 */
export function ProtectedShell({ profile, contextLabel, children }: ProtectedShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <Logo height={32} />
            <span className="text-body-sm text-muted-foreground">{contextLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            {profile.fullName ? <span className="text-body-sm text-foreground hidden sm:inline">{profile.fullName}</span> : null}
            <Link href="/" className="text-body-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to website
            </Link>
            <form action={logout}>
              <button type="submit" className="text-body-sm text-primary-text hover:underline">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
