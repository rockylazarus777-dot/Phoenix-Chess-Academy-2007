import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { buildFaqSchema } from "@/lib/seo/faq";
import type { ProgramFaqItem } from "@/content/programs";

interface ProgramFaqProps {
  items: ProgramFaqItem[];
}

/**
 * Program-specific FAQ — reuses the Phase 4 FaqAccordion rather than a
 * second accordion implementation. Renders nothing (and emits no schema)
 * when a program has no FAQ entries.
 */
export function ProgramFaq({ items }: ProgramFaqProps) {
  if (items.length === 0) return null;

  const schema = buildFaqSchema(items);

  return (
    <Section surface>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="FAQ" title="Common questions about this program" />
        <div className="mt-10">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </Section>
  );
}
