"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/FormField";
import { PasswordField } from "@/components/forms/PasswordField";
import { Button } from "@/components/ui/Button";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/lib/actions/auth";

interface LoginFormProps {
  /** Safe, pre-mapped error text from a prior redirect (e.g. requireRole's ?error=...) — never raw Supabase text. */
  initialError?: string;
  /** Safe, neutral notice from a prior redirect (e.g. ?reset=success) — rendered distinctly from an error. */
  initialNotice?: string;
}

/**
 * Login form. Client-side Zod validation here is UX only — the `login`
 * Server Action re-validates with the same schema. On success the
 * action redirects server-side (Next's redirect throw propagates through
 * this transition); this component only ever needs to render the
 * failure path.
 */
export function LoginForm({ initialError, initialNotice }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });

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
    setNotice(null);
    startTransition(async () => {
      const response = await login(result.data);
      // A resolved (non-redirecting) response is always a failure.
      if (!response.success) {
        setMessage(response.message ?? null);
      }
    });
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
        error={errors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-body-sm text-primary-text hover:underline">
          Forgot password?
        </Link>
      </div>

      {notice ? (
        <div role="status" className="rounded-sm border border-primary/40 bg-primary/5 p-3">
          <p className="text-body-sm text-foreground">{notice}</p>
        </div>
      ) : null}

      {message ? (
        <div role="alert" className="rounded-sm border border-danger/40 bg-danger/5 p-3">
          <p className="text-body-sm text-danger">{message}</p>
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full justify-center">
        {isPending ? "Signing in..." : "Sign In"}
      </Button>

      <div className="text-center">
        <Link href="/" className="text-body-sm text-muted-foreground hover:text-foreground hover:underline">
          Return to website
        </Link>
      </div>
    </form>
  );
}
