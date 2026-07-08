import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

const pathwaySteps = [
  { label: "Beginner", slug: "beginner-chess", description: "First rules, board vision, basic tactics" },
  { label: "Intermediate", slug: "intermediate-chess", description: "Tactical patterns, opening principles" },
  { label: "Advanced", slug: "advanced-chess", description: "Calculation, positional understanding" },
  { label: "Professional Development", slug: "professional-training", description: "High-level competitive training" },
];

/**
 * A general skill-level pathway, not a claim that every student
 * automatically advances through every stage. Text-labeled at every step
 * (not just arrows/color) and laid out as a deliberate vertical stack on
 * mobile rather than a squeezed horizontal flow.
 */
export function TrainingPathway() {
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Training Pathway"
          title="A general path of chess development"
          description="Most students move through these stages as skill develops — coaches guide placement and pacing based on each student's actual progress, not a fixed timeline."
        />

        <ol className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
          {pathwaySteps.map((step, index) => (
            <li key={step.slug} className="flex flex-1 items-center lg:flex-col lg:items-stretch">
              <Link
                href={`/programs/${step.slug}`}
                className="flex-1 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/50"
              >
                <p className="text-caption text-primary-text">Stage {index + 1}</p>
                <p className="text-h4 text-foreground mt-1">{step.label}</p>
                <p className="text-body-sm text-muted-foreground mt-2">{step.description}</p>
              </Link>
              {index < pathwaySteps.length - 1 ? (
                <div className="flex items-center justify-center px-2 py-3 lg:py-2" aria-hidden>
                  <span className="text-primary-text text-h4 lg:rotate-0 rotate-90">→</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border-strong p-5">
            <p className="text-body text-foreground">Tournament Preparation</p>
            <p className="text-body-sm text-muted-foreground mt-1">
              Supports competitive players across relevant levels ahead of tournaments — not a fixed sequential stage.
            </p>
          </div>
          <div className="rounded-2xl border border-border-strong p-5">
            <p className="text-body text-foreground">Online Chess Coaching</p>
            <p className="text-body-sm text-muted-foreground mt-1">
              A training mode available across levels for students who train remotely — not a level above Professional Development.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
