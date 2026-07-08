import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { TournamentRegisterForm } from "@/components/forms/TournamentRegisterForm";
import { getTournaments, getTournamentBySlug, isRegistrationOpenNow } from "@/content/tournaments";
import { resolveCategoryId } from "@/lib/validation/tournamentRegistration";

interface TournamentRegisterPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

// Registration status and the ?category= preselection must always be
// evaluated per-request (not baked into a static shell) — this route
// reads searchParams and needs to reflect live registrationEnabled /
// isRegistrationOpenNow state. Without this, requests for slugs outside
// generateStaticParams's (currently empty) list throw a
// DYNAMIC_SERVER_USAGE error instead of rendering/404-ing correctly.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return getTournaments().map((tournament) => ({ slug: tournament.slug }));
}

export async function generateMetadata({ params }: TournamentRegisterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  return buildMetadata({
    title: tournament ? `Register — ${tournament.name}` : "Tournament Registration",
    description: tournament
      ? `Register for ${tournament.name}.`
      : "Tournament registration.",
    path: `/tournaments/${slug}/register`,
    // Registration pages are per-tournament transactional forms with
    // thin, frequently-changing content and no independent search value
    // beyond the tournament's own detail page — noindex to avoid
    // fragmenting search relevance across a form page and its parent
    // content page.
    index: false,
  });
}

export default async function TournamentRegisterPage({ params, searchParams }: TournamentRegisterPageProps) {
  const { slug } = await params;
  const { category: categorySlug } = await searchParams;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  // Only ever preselects a category when it matches a real, configured
  // category for this specific tournament — an unrecognized ?category=
  // value is silently ignored rather than inserted into the form.
  const resolvedCategory = resolveCategoryId(categorySlug, tournament.categories ?? []);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tournaments", href: "/tournaments" },
    { label: tournament.name, href: `/tournaments/${tournament.slug}` },
    { label: "Register", href: `/tournaments/${tournament.slug}/register` },
  ];

  const registrationOpen = isRegistrationOpenNow(tournament);

  return (
    <>
      <PageHero eyebrow="Register" title={`Register — ${tournament.name}`} />

      <Section className="pb-0">
        <Container>
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          {registrationOpen ? (
            <TournamentRegisterForm tournament={tournament} initialCategoryId={resolvedCategory?.id} />
          ) : (
            <div className="rounded-2xl border border-border-strong bg-surface p-8 text-center">
              <p className="text-h4 text-foreground">
                {tournament.status === "COMPLETED"
                  ? "This tournament has been completed."
                  : tournament.status === "CANCELLED"
                    ? "This tournament has been cancelled."
                    : tournament.status === "REGISTRATION_CLOSED"
                      ? "Registration has closed for this tournament."
                      : "Registration is not currently available for this tournament."}
              </p>
              <p className="text-body-sm text-muted-foreground mt-3">
                Check back on the tournament page for updates, or get in touch directly with any questions.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Button href={`/tournaments/${tournament.slug}`} variant="outline" size="md">
                  Back to Tournament
                </Button>
                <Button href="/contact" variant="primary" size="md">
                  Contact Phoenix
                </Button>
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
