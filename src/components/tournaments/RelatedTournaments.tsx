import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import type { Tournament } from "@/content/tournaments";

interface RelatedTournamentsProps {
  tournaments: Tournament[];
}

/** Renders nothing when a tournament has no valid related tournaments. */
export function RelatedTournaments({ tournaments }: RelatedTournamentsProps) {
  if (tournaments.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Related Tournaments" title="Other Phoenix tournaments" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.slug} tournament={tournament} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
