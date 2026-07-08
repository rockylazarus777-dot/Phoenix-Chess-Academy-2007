import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTournamentDateRange } from "@/lib/dates";
import { getFeaturedTournament } from "@/content/tournaments";

/**
 * Consumes the real tournament system (src/content/tournaments.ts) —
 * the same authoritative source as /tournaments — rather than a
 * separate placeholder shape. No tournament is marked `featured` yet
 * (the array itself is empty), so this renders an honest
 * tournament-promotion section pointing to /tournaments instead of a
 * fabricated event with fake dates/venues/fees. Once a real featured
 * tournament exists, this renders it using the same StatusBadge used
 * throughout the tournament system.
 */
export function FeaturedTournament() {
  const tournament = getFeaturedTournament();

  if (tournament) {
    const location = [tournament.venueName, tournament.city, tournament.state].filter(Boolean).join(", ");

    return (
      <Section>
        <Container className="rounded-2xl border border-border bg-surface p-8 lg:p-12">
          <StatusBadge status={tournament.status} />
          <h2 className="text-h2 text-foreground mt-4">{tournament.name}</h2>
          <p className="text-body text-muted-foreground mt-2">
            {location ? `${location} — ` : ""}
            <time dateTime={tournament.startDate}>
              {formatTournamentDateRange(tournament.startDate, tournament.endDate)}
            </time>
          </p>
          <div className="mt-6">
            <Button href={`/tournaments/${tournament.slug}`} variant="primary" size="lg">
              View Tournament
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container className="rounded-2xl border border-border bg-surface p-8 text-center lg:p-14">
        <p className="text-caption text-primary-text mb-3">Tournaments</p>
        <h2 className="text-h2 text-foreground">Phoenix conducts state-level chess tournaments</h2>
        <p className="text-body-lg text-muted-foreground mt-4 mx-auto max-w-xl">
          See upcoming registration windows, past results, and the full
          tournament calendar.
        </p>
        <div className="mt-8 flex justify-center">
          <Button href="/tournaments" variant="primary" size="lg">
            View Tournaments
          </Button>
        </div>
      </Container>
    </Section>
  );
}
