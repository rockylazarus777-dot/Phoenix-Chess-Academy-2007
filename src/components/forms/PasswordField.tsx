"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/**
 * Password input with an accessible show/hide toggle. Modeled on
 * FormField's aria-describedby pattern. `type="password"` by default —
 * only ever switches to `type="text"` in response to the user's own
 * click on the toggle, never automatically. Never persists the value
 * anywhere outside React state (no localStorage/sessionStorage), and
 * never disables paste or blocks password managers.
 */
export function PasswordField({ label, error, hint, containerClassName, id, className, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className="text-body-sm text-foreground block mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-sm border bg-surface px-4 pr-12 text-body text-foreground placeholder:text-muted-foreground/70",
            error ? "border-danger" : "border-border-strong focus-visible:border-primary",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden="true">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path
                d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M6.5 6.7C4.3 8.2 2.7 10.2 2 12c1.5 3.5 5.5 7 10 7 1.6 0 3.1-.4 4.5-1.1M9.9 4.2A10.8 10.8 0 0 1 12 4c4.5 0 8.5 3.5 10 7-.5 1.2-1.3 2.5-2.3 3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden="true">
              <path d="M2 12c1.5-3.5 5.5-7 10-7s8.5 3.5 10 7c-1.5 3.5-5.5 7-10 7s-8.5-3.5-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.75" />
            </svg>
          )}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-body-sm text-muted-foreground mt-1.5">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-body-sm text-danger mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
