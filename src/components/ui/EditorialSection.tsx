import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils/cn";

interface EditorialSectionProps {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  image?: string;
  imageAlt?: string;
  /** Which side the image renders on at desktop widths. */
  imageSide?: "left" | "right";
  surface?: boolean;
}

/**
 * Alternating text/image section used across About and its subpages.
 * Falls back to a text-only layout when no image is supplied, rather
 * than rendering an empty image box.
 */
export function EditorialSection({
  eyebrow,
  title,
  children,
  image,
  imageAlt,
  imageSide = "right",
  surface = false,
}: EditorialSectionProps) {
  return (
    <Section surface={surface}>
      <Container
        className={cn(
          "grid grid-cols-1 items-center gap-12 lg:gap-16",
          image && "lg:grid-cols-2",
        )}
      >
        <div className={cn(image && imageSide === "left" && "lg:order-2")}>
          {eyebrow ? <p className="text-caption text-primary-text mb-3">{eyebrow}</p> : null}
          <h2 className="text-h2 text-foreground">{title}</h2>
          <div className="text-body-lg text-muted-foreground mt-5 space-y-4">{children}</div>
        </div>

        {image ? (
          <div className={cn("relative aspect-4/3 overflow-hidden rounded-2xl border border-border", imageSide === "left" && "lg:order-1")}>
            <Image src={image} alt={imageAlt ?? ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
