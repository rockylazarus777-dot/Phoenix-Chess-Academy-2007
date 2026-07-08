import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Tournament } from "@/content/tournaments";

interface TournamentVenueProps {
  tournament: Tournament;
}

export function TournamentVenue({ tournament }: TournamentVenueProps) {
  const hasVenue = Boolean(tournament.venueName || tournament.address || tournament.city);
  if (!hasVenue) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Venue" title="Where the tournament takes place" />
        <div className="mt-8 max-w-xl space-y-1 text-body text-foreground/90">
          {tournament.venueName ? <p className="text-h4 text-foreground">{tournament.venueName}</p> : null}
          {tournament.address ? <p>{tournament.address}</p> : null}
          <p>{[tournament.city, tournament.state, tournament.country].filter(Boolean).join(", ")}</p>
          {tournament.mapUrl ? (
            <a
              href={tournament.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-body-sm text-primary-text hover:underline"
            >
              View on map →
            </a>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
