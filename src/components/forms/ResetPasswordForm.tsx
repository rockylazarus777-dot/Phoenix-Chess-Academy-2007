"use client";

import { useState, useTransition } from "react";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { updatePassword } from "@/lib/actions/auth";

/**
 * Reset-password form. Requires the recovery session already established
 * by /auth/callback (this form does not collect an email or token). On
 * success, `updatePassword` redirects server-side to
 * `/login?reset=success` — it deliberately does not grant portal access
 * directly, so this component only ever needs to render the failure
 * path.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setMessage(null);
      return;
    }

    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const response = await updatePassword(result.data);
      if (!response.success) {
        setMessage(response.message ?? null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <PasswordField
        label="New Password"
        name="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <PasswordField
        label="Confirm New Password"
        name="confirmPassword"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
      />

      {message ? (
        <div role="alert" className="rounded-sm border border-danger/40 bg-danger/5 p-3">
          <p className="text-body-sm text-danger">{message}</p>
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full justify-center">
        {isPending ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
