import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildTournamentEventSchema } from "@/lib/seo/event";
import { TournamentHero } from "@/components/tournaments/TournamentHero";
import { TournamentCategories } from "@/components/tournaments/TournamentCategories";
import { TournamentSchedule } from "@/components/tournaments/TournamentSchedule";
import { TournamentVenue } from "@/components/tournaments/TournamentVenue";
import { TournamentRegistrationInfo } from "@/components/tournaments/TournamentRegistrationInfo";
import { TournamentRules } from "@/components/tournaments/TournamentRules";
import { TournamentDocuments } from "@/components/tournaments/TournamentDocuments";
import { TournamentOrganizer } from "@/components/tournaments/TournamentOrganizer";
import { TournamentResultsPreview } from "@/components/tournaments/TournamentResultsPreview";
import { TournamentWinners } from "@/components/tournaments/TournamentWinners";
import { TournamentGallery } from "@/components/tournaments/TournamentGallery";
import { TournamentFaq } from "@/components/tournaments/TournamentFaq";
import { RelatedTournaments } from "@/components/tournaments/RelatedTournaments";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getTournaments, getTournamentBySlug, getRelatedTournaments } from "@/content/tournaments";

interface TournamentDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Empty today (no tournament records yet) — generates zero static
  // pages, which is expected. Any slug not in this list 404s via
  // notFound() below rather than rendering a broken page.
  return getTournaments().map((tournament) => ({ slug: tournament.slug }));
}

export async function generateMetadata({ params }: TournamentDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    return buildMetadata({
      title: "Tournament Not Found",
      description: "This tournament could not be found.",
      path: `/tournaments/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: tournament.seoTitle ?? tournament.name,
    description: tournament.seoDescription ?? tournament.description,
    path: `/tournaments/${tournament.slug}`,
  });
}

export default async function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const relatedTournaments = getRelatedTournaments(tournament);
  const eventSchema = buildTournamentEventSchema(tournament);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tournaments", href: "/tournaments" },
    { label: tournament.name, href: `/tournaments/${tournament.slug}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />

      <TournamentHero tournament={tournament} breadcrumbItems={breadcrumbItems} />

      <Section className="pb-0">
        <Container>
          <p className="text-body-lg text-muted-foreground max-w-2xl">{tournament.description}</p>
        </Container>
      </Section>

      <TournamentCategories categories={tournament.categories} />
      <TournamentSchedule schedule={tournament.schedule} />
      <TournamentVenue tournament={tournament} />
      <TournamentRegistrationInfo tournament={tournament} />
      <TournamentRules rules={tournament.rules} />
      <TournamentDocuments documents={tournament.documents} />
      <TournamentOrganizer tournament={tournament} />
      <TournamentResultsPreview tournament={tournament} />
      <TournamentWinners winners={tournament.winners} />
      <TournamentGallery images={tournament.gallery} tournamentName={tournament.name} />
      <TournamentFaq items={tournament.faq} />
      <RelatedTournaments tournaments={relatedTournaments} />
      <TrialCTA />
    </>
  );
}
