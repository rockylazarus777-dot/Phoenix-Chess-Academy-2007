import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface WhoThisIsForProps {
  recommendedFor: string[];
}

/**
 * Helps a visitor self-identify without strict FIDE rating boundaries —
 * descriptive, not numeric.
 */
export function WhoThisIsFor({ recommendedFor }: WhoThisIsForProps) {
  if (recommendedFor.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Who This Program Is For" title="Recommended for students who..." />
        <ul className="mt-8 space-y-3 max-w-2xl">
          {recommendedFor.map((item) => (
            <li key={item} className="text-body-lg text-muted-foreground flex gap-3">
              <span className="text-primary-text" aria-hidden>—</span>
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
