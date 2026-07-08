import { Container } from "@/components/ui/Container";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

/**
 * Shared hero band for interior (non-home) pages — About, Coaches,
 * Contact, FAQ, legal pages, etc. Simpler than the home Hero (no video
 * architecture) since these pages don't need the cinematic treatment.
 */
export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="border-b border-border bg-surface">
      <Container className="py-16 lg:py-20">
        {eyebrow ? <p className="text-caption text-primary-text mb-3">{eyebrow}</p> : null}
        <h1 className="text-h1 text-foreground max-w-2xl">{title}</h1>
        {description ? (
          <p className="text-body-lg text-muted-foreground mt-4 max-w-xl">{description}</p>
        ) : null}
      </Container>
    </section>
  );
}
