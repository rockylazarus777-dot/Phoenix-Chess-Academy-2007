import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildCourseSchema } from "@/lib/seo/course";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { ProgramHero } from "@/components/programs/ProgramHero";
import { ProgramOverview } from "@/components/programs/ProgramOverview";
import { WhoThisIsFor } from "@/components/programs/WhoThisIsFor";
import { DevelopmentAreas } from "@/components/programs/DevelopmentAreas";
import { TrainingApproach } from "@/components/programs/TrainingApproach";
import { SkillsList } from "@/components/programs/SkillsList";
import { ProgramHighlights } from "@/components/programs/ProgramHighlights";
import { ProgramAchievements } from "@/components/programs/ProgramAchievements";
import { ProgramCoaches } from "@/components/programs/ProgramCoaches";
import { ProgramFaq } from "@/components/programs/ProgramFaq";
import { RelatedPrograms } from "@/components/programs/RelatedPrograms";
import { TrialCTA } from "@/components/home/TrialCTA";
import { philosophyPoints } from "@/content/about";
import { getPrograms, getProgramBySlug, getRelatedPrograms } from "@/content/programs";

interface ProgramPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPrograms().map((program) => ({ slug: program.slug }));
}

export async function generateMetadata({ params }: ProgramPageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgramBySlug(slug);

  if (!program) {
    return buildMetadata({
      title: "Program Not Found",
      description: "This program could not be found.",
      path: `/programs/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: `${program.name} Training`,
    description: program.shortDescription,
    path: `/programs/${program.slug}`,
  });
}

export default async function ProgramDetailPage({ params }: ProgramPageProps) {
  const { slug } = await params;
  const program = getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const relatedPrograms = getRelatedPrograms(program);
  const courseSchema = buildCourseSchema(program);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Programs", href: "/programs" },
    { label: program.name, href: `/programs/${program.slug}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }} />

      <ProgramHero program={program} breadcrumbItems={breadcrumbItems} />
      <ProgramOverview description={program.description} />
      <WhoThisIsFor recommendedFor={program.recommendedFor} />
      <DevelopmentAreas areas={program.developmentAreas} />
      <TrainingApproach programSlug={program.slug} />
      <SkillsList skills={program.skills} />
      <ProgramHighlights highlights={program.highlights} />

      <Section>
        <Container>
          <SectionHeader eyebrow="Phoenix Training Philosophy" title="What guides every Phoenix program" />
          <div className="mt-12">
            <PointsGrid points={philosophyPoints} />
          </div>
        </Container>
      </Section>

      <ProgramAchievements slug={program.slug} />
      <ProgramCoaches slug={program.slug} />
      <ProgramFaq items={program.faq} />
      <RelatedPrograms programs={relatedPrograms} />
      <TrialCTA />
    </>
  );
}
