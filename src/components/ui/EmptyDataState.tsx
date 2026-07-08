import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";

interface EmptyDataStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  surface?: boolean;
}

/**
 * Consistent "no confirmed data yet" fallback used wherever real content
 * (leadership, coaches, achievements, etc.) hasn't been supplied. Renders
 * an honest, on-brand message instead of fabricated cards.
 */
export function EmptyDataState({ eyebrow, title, description, ctaLabel, ctaHref, surface }: EmptyDataStateProps) {
  return (
    <Section surface={surface}>
      <Container className="text-center">
        <SectionHeader eyebrow={eyebrow} title={title} description={description} align="center" className="mx-auto" />
        {ctaLabel && ctaHref ? (
          <div className="mt-8">
            <Button href={ctaHref} variant="outline" size="md">
              {ctaLabel}
            </Button>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
