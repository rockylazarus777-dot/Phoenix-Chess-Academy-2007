import { useId } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export function TextareaField({
  label,
  error,
  hint,
  containerClassName,
  id,
  className,
  ...props
}: TextareaFieldProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={textareaId} className="text-body-sm text-foreground block mb-2">
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        rows={5}
        className={cn(
          "w-full rounded-sm border bg-surface px-4 py-3 text-body text-foreground placeholder:text-muted-foreground/70",
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
