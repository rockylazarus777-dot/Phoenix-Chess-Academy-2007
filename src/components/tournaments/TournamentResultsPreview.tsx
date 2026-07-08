import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { TournamentResultsTable } from "@/components/tournaments/TournamentResultsTable";
import { hasMeaningfulResults, type Tournament } from "@/content/tournaments";

interface TournamentResultsPreviewProps {
  tournament: Tournament;
}

/**
 * Compact results preview on the tournament detail page — top rows only,
 * linking to the full standings at /tournaments/[slug]/results. Only
 * renders once the tournament has completed AND real results exist;
 * never a fabricated standings table.
 */
export function TournamentResultsPreview({ tournament }: TournamentResultsPreviewProps) {
  if (tournament.status !== "COMPLETED" || !hasMeaningfulResults(tournament)) return null;

  const topResults = tournament.results!.slice(0, 3);

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Results" title="Top results" />
        <div className="mt-8">
          <TournamentResultsTable results={topResults} categories={tournament.categories} />
        </div>
        <div className="mt-8">
          <Button href={`/tournaments/${tournament.slug}/results`} variant="outline" size="md">
            View Full Results
          </Button>
        </div>
      </Container>
    </Section>
  );
}
