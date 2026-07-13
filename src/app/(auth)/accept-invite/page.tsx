import { buildMetadata } from "@/lib/seo/metadata";
import { AcceptInviteForm } from "@/components/forms/AcceptInviteForm";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getSafeAuthMessage } from "@/lib/auth/errors";

export const metadata = buildMetadata({
  title: "Accept Invitation",
  description: "Create your password to activate your Phoenix Chess Academy portal account.",
  path: "/accept-invite",
  index: false,
});

/**
 * Reached only after /auth/callback exchanges a valid invite code for a
 * session (see src/lib/actions/admin/accounts.ts's `redirectTo`,
 * `?next=/accept-invite`). Unlike /reset-password, this page verifies the
 * session itself before rendering the form: an invite link that is
 * expired, already used, or never exchanged successfully never reaches
 * this page at all (the failed exchange in /auth/callback redirects to
 * /login?error=SESSION_ERROR before ever getting here), but this check
 * also covers a stale bookmark/back-button visit after the invite session
 * has since ended, showing the same friendly "expired" message rather
 * than a broken form. `acceptInvite()` (the Server Action) is still the
 * actual authority — this render-time check is a UX improvement, not a
 * replacement for it.
 */
export default async function AcceptInvitePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-2">
        <p className="text-h4 text-foreground">Invitation expired</p>
        <p className="text-body-sm text-muted-foreground">{getSafeAuthMessage("INVITE_EXPIRED")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <div className="text-center mb-6">
        <p className="text-h4 text-foreground">Create your password</p>
        <p className="text-body-sm text-muted-foreground mt-1">
          Set a password to activate your Phoenix Chess Academy account.
        </p>
      </div>
      <AcceptInviteForm />
    </div>
  );
}
