import { buildMetadata } from "@/lib/seo/metadata";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

export const metadata = buildMetadata({
  title: "Reset Password",
  description: "Set a new password for your Phoenix Chess Academy account.",
  path: "/reset-password",
  index: false,
});

/**
 * Reached only after /auth/callback exchanges a valid recovery code for
 * a session. This page does not itself verify the session — it renders
 * the form unconditionally, and `updatePassword()` (the Server Action)
 * is the actual authority: it checks for a real session and fails safely
 * with RESET_FAILED if none exists (e.g. a stale/expired/already-used
 * link visited directly).
 */
export default function ResetPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <div className="text-center mb-6">
        <p className="text-h4 text-foreground">Set a new password</p>
        <p className="text-body-sm text-muted-foreground mt-1">Choose a new password for your account.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
