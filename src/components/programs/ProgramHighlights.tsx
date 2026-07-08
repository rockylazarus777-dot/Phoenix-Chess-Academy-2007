import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import type { ProgramHighlight } from "@/content/programs";

interface ProgramHighlightsProps {
  highlights?: ProgramHighlight[];
}

/**
 * Renders only configured, confirmed highlight values — never "TBD",
 * "Coming Soon", or a guessed value. Most programs currently have none,
 * in which case this renders nothing.
 */
export function ProgramHighlights({ highlights }: ProgramHighlightsProps) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <Section className="py-10">
      <Container>
        <div className="flex flex-wrap gap-4">
          {highlights.map((highlight) => (
            <div key={highlight.label} className="rounded-2xl border border-border-strong px-5 py-3">
              <p className="text-caption text-muted-foreground">{highlight.label}</p>
              <p className="text-body text-foreground mt-1">{highlight.value}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
