import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { TournamentRuleSection } from "@/content/tournaments";

interface TournamentRulesProps {
  rules?: TournamentRuleSection[];
}

export function TournamentRules({ rules }: TournamentRulesProps) {
  if (!rules || rules.length === 0) return null;

  return (
    <Section surface>
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="Rules" title="Tournament rules" />
        <div className="mt-10 space-y-8">
          {rules.map((section) => (
            <div key={section.title} className="border-t border-border pt-5">
              <h3 className="text-h4 text-foreground">{section.title}</h3>
              <p className="text-body-sm text-muted-foreground mt-2 whitespace-pre-line">{section.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
