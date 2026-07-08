import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "navy" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const baseStyles =
  "text-button inline-flex items-center justify-center gap-2 rounded-sm transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-surface-elevated text-foreground border border-border-strong hover:bg-surface",
  outline: "border border-border-strong text-foreground hover:border-primary hover:text-primary-text",
  ghost: "text-foreground hover:bg-surface-elevated",
  // Used sparingly — secondary brand accent, not a default action style.
  navy: "bg-accent text-accent-foreground hover:bg-brand-navy-deep",
  danger: "bg-danger text-danger-foreground hover:bg-danger/90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4",
  md: "h-11 px-6",
  lg: "h-13 px-8 text-[0.95rem]",
};

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Reserves space for a future loading spinner without shipping one yet. */
  isLoading?: boolean;
  children: React.ReactNode;
}

type ButtonAsButton = BaseButtonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = BaseButtonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Shared button primitive. Renders a real <button> for actions and a real
 * <a> (via next/link) for navigation — never a clickable <div>. Supports
 * primary/secondary/outline/ghost/navy/danger variants and sm/md/lg sizes, with
 * keyboard focus and disabled states handled via globals.css / Tailwind.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  isLoading = false,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if ("href" in props && props.href) {
    const { href, ...anchorProps } = props;
    return (
      <Link href={href} className={classes} aria-disabled={isLoading} {...anchorProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      className={classes}
      disabled={isLoading || buttonProps.disabled}
      aria-busy={isLoading || undefined}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
