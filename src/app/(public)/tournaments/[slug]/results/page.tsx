import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { TournamentResultsTable } from "@/components/tournaments/TournamentResultsTable";
import { TournamentWinners } from "@/components/tournaments/TournamentWinners";
import { getTournaments, getTournamentBySlug, hasMeaningfulResults } from "@/content/tournaments";

interface TournamentResultsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getTournaments().map((tournament) => ({ slug: tournament.slug }));
}

export async function generateMetadata({ params }: TournamentResultsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);
  const meaningfulResults = tournament ? hasMeaningfulResults(tournament) : false;

  return buildMetadata({
    title: tournament ? `Results — ${tournament.name}` : "Tournament Results",
    description: tournament ? `Results for ${tournament.name}.` : "Tournament results.",
    path: `/tournaments/${slug}/results`,
    // Only index a results page once it holds real, meaningful public
    // results — an empty/status-aware placeholder page has no unique
    // content worth surfacing in search.
    index: meaningfulResults,
  });
}

function statusAwareMessage(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Tournament results are being prepared for publication.";
    case "LIVE":
      return "Results are not yet finalized.";
    case "CANCELLED":
      return "This tournament was cancelled — no results are available.";
    default:
      return "Results will be published after the tournament.";
  }
}

export default async function TournamentResultsPage({ params }: TournamentResultsPageProps) {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tournaments", href: "/tournaments" },
    { label: tournament.name, href: `/tournaments/${tournament.slug}` },
    { label: "Results", href: `/tournaments/${tournament.slug}/results` },
  ];

  const meaningfulResults = hasMeaningfulResults(tournament);

  return (
    <>
      <PageHero eyebrow="Results" title={`Results — ${tournament.name}`} />

      <Section className="pb-0">
        <Container>
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </Section>

      {meaningfulResults ? (
        <>
          <Section>
            <Container>
              <TournamentResultsTable results={tournament.results!} categories={tournament.categories} />
            </Container>
          </Section>
          <TournamentWinners winners={tournament.winners} />
        </>
      ) : (
        <Section>
          <Container>
            <div className="rounded-2xl border border-border-strong bg-surface p-8 text-center">
              <p className="text-h4 text-foreground">{statusAwareMessage(tournament.status)}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Button href={`/tournaments/${tournament.slug}`} variant="outline" size="md">
                  Back to Tournament
                </Button>
                <Button href="/contact" variant="primary" size="md">
                  Contact Phoenix
                </Button>
              </div>
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}
