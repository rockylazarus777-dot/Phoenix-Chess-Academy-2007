import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { TrialForm } from "@/components/forms/TrialForm";
import { resolveProgramSlugToLabel } from "@/lib/validation/trial";
import { getProgramBySlug } from "@/content/programs";

export const metadata = buildMetadata({
  title: "Book a Trial",
  description: "Book a trial class with Phoenix Chess Academy and experience the training approach firsthand.",
  path: "/book-trial",
});

interface BookTrialPageProps {
  searchParams: Promise<{ program?: string }>;
}

export default async function BookTrialPage({ searchParams }: BookTrialPageProps) {
  const { program: programSlug } = await searchParams;

  // Only ever preselects a program when the slug matches real, active
  // program data — an unrecognized ?program= value (e.g. "fake-program")
  // is silently ignored rather than inserted into the form.
  const initialProgram = resolveProgramSlugToLabel(programSlug, getProgramBySlug);

  return (
    <>
      <PageHero
        eyebrow="Book a Trial"
        title="Start with a trial class"
        description="Tell us about the student and training goals — the academy will follow up to confirm a trial class."
      />

      <Section>
        <Container className="max-w-3xl">
          <TrialForm initialProgram={initialProgram} />
        </Container>
      </Section>
    </>
  );
}
