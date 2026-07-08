"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/lib/actions/auth";

/**
 * Forgot-password form. Always ends in the same neutral acknowledgement
 * regardless of whether the email matches a real account — this is
 * deliberate account-enumeration protection (see
 * requestPasswordReset in src/lib/actions/auth.ts), not a bug.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<"idle" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = forgotPasswordSchema.safeParse({ email });

    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    startTransition(async () => {
      const response = await requestPasswordReset(result.data);
      setMessage(response.message ?? null);
      if (response.success) {
        setPhase("done");
      }
    });
  }

  if (phase === "done") {
    return (
      <div className="text-center">
        <p className="text-body text-foreground">{message}</p>
        <div className="mt-6">
          <Link href="/login" className="text-body-sm text-primary-text hover:underline">
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />

      {message && !error ? (
        <div role="alert" className="rounded-sm border border-danger/40 bg-danger/5 p-3">
          <p className="text-body-sm text-danger">{message}</p>
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full justify-center">
        {isPending ? "Sending..." : "Send Reset Instructions"}
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-body-sm text-muted-foreground hover:text-foreground hover:underline">
          Return to login
        </Link>
      </div>
    </form>
  );
}
