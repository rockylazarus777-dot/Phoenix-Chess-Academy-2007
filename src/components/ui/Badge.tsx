import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "primary" | "outline";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-elevated text-muted-foreground border border-border",
  primary: "bg-primary/10 text-primary-text border border-primary/30",
  outline: "border border-border-strong text-foreground",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

/** Small label used for tags, categories, and metadata chips. */
export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "text-caption inline-flex items-center rounded-sm px-2.5 py-1",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
