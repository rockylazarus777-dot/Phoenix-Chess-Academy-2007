import { useId } from "react";
import { cn } from "@/lib/utils/cn";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

/**
 * Labeled text input with associated error/hint text wired via
 * aria-describedby — errors are never communicated by color alone (the
 * error text itself, plus aria-invalid, carries the meaning).
 */
export function FormField({ label, error, hint, containerClassName, id, className, ...props }: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={inputId} className="text-body-sm text-foreground block mb-2">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-sm border bg-surface px-4 text-body text-foreground placeholder:text-muted-foreground/70",
          error ? "border-danger" : "border-border-strong focus-visible:border-primary",
          className,
        )}
        {...props}
      />
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
