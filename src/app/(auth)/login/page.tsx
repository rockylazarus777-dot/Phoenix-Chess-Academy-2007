import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { LoginForm } from "@/components/forms/LoginForm";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getRoleHome } from "@/lib/auth/roles";
import { resolveAuthErrorCode, getSafeAuthMessage } from "@/lib/auth/errors";

export const metadata = buildMetadata({
  title: "Login",
  description: "Log in to your Phoenix Chess Academy student, parent, or coach account.",
  path: "/login",
  index: false,
});

interface LoginPageProps {
  searchParams: Promise<{ error?: string; reset?: string }>;
}

/**
 * Canonical login route — the only login experience in the app (there is
 * deliberately no /signup route; see docs/AUTH_ARCHITECTURE.md, "No
 * Public Signup"). An already-authenticated user with a valid, active
 * profile is redirected straight to their role home rather than shown
 * the form again; anyone else (including a signed-in user whose profile
 * is missing/inactive — an edge case `login()`/`requireRole()` already
 * guard against in the normal flow) sees the form.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const profile = await getCurrentProfile();
  if (profile && profile.active) {
    redirect(getRoleHome(profile.role));
  }

  const params = await searchParams;

  const initialError = params.error ? getSafeAuthMessage(resolveAuthErrorCode(params.error)) : undefined;
  const initialNotice = params.reset === "success" ? "Your password has been updated. Please sign in." : undefined;

  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <div className="text-center mb-6">
        <p className="text-h4 text-foreground">Welcome back</p>
        <p className="text-body-sm text-muted-foreground mt-1">Sign in to your Phoenix Chess Academy account.</p>
      </div>
      <LoginForm initialError={initialError} initialNotice={initialNotice} />
    </div>
  );
}
