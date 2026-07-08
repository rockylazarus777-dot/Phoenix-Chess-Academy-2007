import { cn } from "@/lib/utils/cn";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/**
 * Consistent heading block used at the top of home page / content
 * sections: optional eyebrow label, heading, optional supporting copy.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-caption text-primary-text mb-3">{eyebrow}</p>
      ) : null}
      <h2 className="text-h2 text-foreground">{title}</h2>
      {description ? (
        <p className="text-body-lg text-muted-foreground mt-4">{description}</p>
      ) : null}
    </div>
  );
}
