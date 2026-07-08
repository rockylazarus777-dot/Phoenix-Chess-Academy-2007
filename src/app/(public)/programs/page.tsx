import { buildMetadata } from "@/lib/seo/metadata";
import { buildFaqSchema } from "@/lib/seo/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { TrainingPathway } from "@/components/programs/TrainingPathway";
import { ProgramDiscovery } from "@/components/programs/ProgramDiscovery";
import { TrainingApproach } from "@/components/programs/TrainingApproach";
import { ProgramComparison } from "@/components/programs/ProgramComparison";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getPrograms, getProgramBySlug } from "@/content/programs";
import { faqItems } from "@/content/faq";

export const metadata = buildMetadata({
  title: "Chess Training Programs",
  description: "Structured chess training programs from Phoenix Chess Academy — beginner through professional, plus tournament preparation and online coaching.",
  path: "/programs",
});

const programFaqItems = faqItems.filter((item) => item.category === "Programs" || item.category === "Online Coaching");

export default function ProgramsPage() {
  const programs = getPrograms();
  const onlineCoaching = getProgramBySlug("online-chess-coaching");
  const faqSchema = buildFaqSchema(programFaqItems);

  return (
    <>
      {programFaqItems.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}

      <PageHero
        eyebrow="Training Programs"
        title="Structured chess training at every level"
        description="From a student's first move to professional tournament preparation — find the program that matches where you are today."
      />

      <Section className="pb-0">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Programs", href: "/programs" }]} />
        </Container>
      </Section>

      <TrainingPathway />
      <ProgramDiscovery />

      <Section>
        <Container>
          <SectionHeader eyebrow="All Programs" title="Every Phoenix training program" />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <ProgramCard key={program.slug} program={program} />
            ))}
          </div>
        </Container>
      </Section>

      <TrainingApproach />
      <ProgramComparison programs={programs} />

      {onlineCoaching ? (
        <Section>
          <Container className="rounded-2xl border border-border bg-surface p-8 lg:p-12 text-center">
            <p className="text-caption text-primary-text mb-3">Can&apos;t Train In Person?</p>
            <h2 className="text-h2 text-foreground">{onlineCoaching.shortDescription}</h2>
            <div className="mt-6">
              <Button href={`/programs/${onlineCoaching.slug}`} variant="primary" size="lg">
                Explore Online Coaching
              </Button>
            </div>
          </Container>
        </Section>
      ) : null}

      {programFaqItems.length > 0 ? (
        <Section surface>
          <Container className="max-w-3xl">
            <SectionHeader eyebrow="FAQ" title="Common questions about Phoenix programs" />
            <div className="mt-10">
              <FaqAccordion items={programFaqItems} />
            </div>
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
