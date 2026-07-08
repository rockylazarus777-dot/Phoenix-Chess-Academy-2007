import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getTrainingMethodology, getTrainingMethodologyForProgram } from "@/content/training";

interface TrainingApproachProps {
  /**
   * When provided (a program detail page), only methodology items
   * relevant to this program are shown. When omitted (the general
   * /programs listing page), the full methodology is shown.
   */
  programSlug?: string;
}

/**
 * Phoenix's training methodology — one shared component/content source
 * (src/content/training.ts) rather than restating it per program. Shows
 * the full methodology on the general listing page, and only the
 * relevant subset on a specific program's detail page.
 */
export function TrainingApproach({ programSlug }: TrainingApproachProps) {
  const steps = programSlug ? getTrainingMethodologyForProgram(programSlug) : getTrainingMethodology();

  if (steps.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Training Approach"
          title="How Phoenix training works"
          description="The same training methodology applies across levels — only the material changes."
        />
        <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.id}>
              <p className="text-caption text-primary-text">{String(index + 1).padStart(2, "0")}</p>
              <p className="text-h4 text-foreground mt-2">{step.title}</p>
              <p className="text-body-sm text-muted-foreground mt-2">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
