import { cn } from "@/lib/utils/cn";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Reusable page container. Constrains content width to the site-wide
 * --page-max-width token (defined in globals.css) and applies the
 * responsive horizontal padding used everywhere, so individual pages never
 * need to invent their own max-width/padding combination.
 */
export function Container({ children, className, as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-(--page-max-width) px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </Tag>
  );
}
