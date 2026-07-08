import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import type { Tournament } from "@/content/tournaments";

interface TournamentStatusSectionProps {
  eyebrow: string;
  title: string;
  tournaments: Tournament[];
  surface?: boolean;
}

/**
 * Shared section renderer for each status group on /tournaments
 * (Registration Open, Upcoming, Ongoing, Past) — one implementation
 * instead of four near-identical blocks. Renders nothing when a group
 * has no tournaments, so empty groups never show an empty heading.
 */
export function TournamentStatusSection({ eyebrow, title, tournaments, surface }: TournamentStatusSectionProps) {
  if (tournaments.length === 0) return null;

  return (
    <Section surface={surface}>
      <Container>
        <SectionHeader eyebrow={eyebrow} title={title} />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.slug} tournament={tournament} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
