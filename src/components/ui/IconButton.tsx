import { cn } from "@/lib/utils/cn";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only buttons must always have an accessible name. */
  "aria-label": string;
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Icon-only button (menu toggle, close button) with a mandatory aria-label.
 * React 19 passes `ref` through as a normal prop, so no forwardRef wrapper
 * is needed here.
 */
export function IconButton({ className, children, ref, ...props }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
