import { cn } from "@/lib/utils/cn";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Soft Cream background instead of the default Warm Ivory page background. */
  surface?: boolean;
  /** White background — used for card-forward sections (Programs, Testimonials). */
  elevated?: boolean;
  /** Deep Navy dark section, used sparingly (academy statistics, achievements, footer). */
  dark?: boolean;
}

/**
 * Reusable section spacing wrapper. Keeps vertical rhythm consistent
 * across the home page and future content pages instead of every section
 * choosing its own padding. `dark` opts into the `.on-dark` token override
 * (see globals.css) so nested components automatically render with correct
 * contrast without any per-component dark-mode classes.
 */
export function Section({ children, className, id, surface = false, elevated = false, dark = false }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-14 sm:py-18 lg:py-24",
        dark ? "on-dark bg-background" : "bg-background",
        !dark && elevated && "bg-surface-elevated",
        !dark && !elevated && surface && "bg-surface",
        className,
      )}
    >
      {children}
    </section>
  );
}
