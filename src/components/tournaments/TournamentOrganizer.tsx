import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Tournament } from "@/content/tournaments";

interface TournamentOrganizerProps {
  tournament: Tournament;
}

/** Renders only the organizer/arbiter/contact fields actually configured. */
export function TournamentOrganizer({ tournament }: TournamentOrganizerProps) {
  const facts: { label: string; value: string }[] = [];

  if (tournament.organizer) facts.push({ label: "Organizer", value: tournament.organizer });
  if (tournament.chiefArbiter) facts.push({ label: "Chief Arbiter", value: tournament.chiefArbiter });
  if (tournament.contact) facts.push({ label: "Contact", value: tournament.contact });

  if (facts.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Organizer" title="Organizer & contact" />
        <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="border-t border-border pt-4">
              <dt className="text-caption text-muted-foreground">{fact.label}</dt>
              <dd className="text-body text-foreground mt-1">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
