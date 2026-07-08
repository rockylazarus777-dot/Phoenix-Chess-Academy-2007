import { useId } from "react";
import { cn } from "@/lib/utils/cn";

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

export function SelectField({
  label,
  error,
  hint,
  containerClassName,
  id,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={selectId} className="text-body-sm text-foreground block mb-2">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-sm border bg-surface px-4 text-body text-foreground",
          error ? "border-danger" : "border-border-strong focus-visible:border-primary",
          className,
        )}
        {...props}
      >
        {children}
      </select>
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
