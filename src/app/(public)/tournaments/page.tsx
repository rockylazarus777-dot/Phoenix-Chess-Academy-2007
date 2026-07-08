import { buildMetadata } from "@/lib/seo/metadata";
import { buildFaqSchema } from "@/lib/seo/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { TournamentStatusSection } from "@/components/tournaments/TournamentStatusSection";
import { TournamentsEmptyState } from "@/components/tournaments/TournamentsEmptyState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getFeaturedTournament, getTournaments, getTournamentsByStatus } from "@/content/tournaments";
import { trainingMethodology } from "@/content/training";
import { faqItems } from "@/content/faq";

export const metadata = buildMetadata({
  title: "Chess Tournaments",
  description: "Phoenix Chess Academy's state-level chess tournaments — registration, schedules, and results.",
  path: "/tournaments",
});

const tournamentFaqItems = faqItems.filter((item) => item.category === "Tournaments");

// Reuses the shared training-methodology content (src/content/training.ts)
// rather than writing new tournament-specific philosophy copy — no
// duplicated descriptions.
const tournamentPhilosophyPoints = trainingMethodology.filter(
  (item) => item.id === "tournament-experience" || item.id === "clock-training",
);

export default function TournamentsPage() {
  const allTournaments = getTournaments();
  const featured = getFeaturedTournament();
  const registrationOpen = getTournamentsByStatus("REGISTRATION_OPEN");
  const upcoming = getTournamentsByStatus("UPCOMING");
  const ongoing = getTournamentsByStatus("LIVE");
  const completed = getTournamentsByStatus("COMPLETED");
  const faqSchema = buildFaqSchema(tournamentFaqItems);

  return (
    <>
      {tournamentFaqItems.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}

      <PageHero
        eyebrow="Tournaments"
        title="Phoenix chess tournaments"
        description="State-level tournaments, academy events, and open competitions — built into how Phoenix trains its students."
      />

      <Section className="pb-0">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tournaments", href: "/tournaments" }]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Competitive Chess at Phoenix"
            title="Tournament experience is part of the curriculum"
            description="Every level of Phoenix training treats competitive play as part of a student's development, not an optional extra — tournament preparation carries through from Tournament Preparation to Professional Chess Training."
          />
        </Container>
      </Section>

      {featured ? (
        <TournamentStatusSection eyebrow="Featured" title="Featured tournament" tournaments={[featured]} surface />
      ) : null}

      {allTournaments.length === 0 ? (
        <TournamentsEmptyState />
      ) : (
        <>
          <TournamentStatusSection
            eyebrow="Registration Open"
            title="Register now"
            tournaments={registrationOpen}
          />
          <TournamentStatusSection eyebrow="Upcoming" title="Upcoming tournaments" tournaments={upcoming} surface />
          <TournamentStatusSection eyebrow="Live" title="Ongoing tournaments" tournaments={ongoing} />
          <TournamentStatusSection eyebrow="Past Tournaments" title="Completed tournaments" tournaments={completed} surface />
        </>
      )}

      {tournamentPhilosophyPoints.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader eyebrow="Tournament Philosophy" title="How Phoenix prepares students to compete" />
            <div className="mt-12">
              <PointsGrid points={tournamentPhilosophyPoints} columns={2} />
            </div>
          </Container>
        </Section>
      ) : null}

      {tournamentFaqItems.length > 0 ? (
        <Section surface>
          <Container className="max-w-3xl">
            <SectionHeader eyebrow="FAQ" title="Common questions about Phoenix tournaments" />
            <div className="mt-10">
              <FaqAccordion items={tournamentFaqItems} />
            </div>
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
