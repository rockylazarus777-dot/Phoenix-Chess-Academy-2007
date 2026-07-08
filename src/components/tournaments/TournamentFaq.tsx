import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { buildFaqSchema } from "@/lib/seo/faq";
import type { TournamentFaqItem } from "@/content/tournaments";

interface TournamentFaqProps {
  items?: TournamentFaqItem[];
}

/**
 * Reuses the shared FaqAccordion rather than a second implementation.
 * Renders nothing (and emits no JSON-LD) when a tournament has no FAQ
 * entries — never invents Phoenix-specific answers where policy isn't
 * confirmed.
 */
export function TournamentFaq({ items }: TournamentFaqProps) {
  if (!items || items.length === 0) return null;

  const schema = buildFaqSchema(items);

  return (
    <Section surface>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="FAQ" title="Common questions about this tournament" />
        <div className="mt-10">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </Section>
  );
}
