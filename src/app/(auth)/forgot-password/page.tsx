import { buildMetadata } from "@/lib/seo/metadata";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";

export const metadata = buildMetadata({
  title: "Forgot Password",
  description: "Reset your Phoenix Chess Academy account password.",
  path: "/forgot-password",
  index: false,
});

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <div className="text-center mb-6">
        <p className="text-h4 text-foreground">Reset your password</p>
        <p className="text-body-sm text-muted-foreground mt-1">
          Enter your account email and we&apos;ll send password reset instructions if an eligible account exists.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
