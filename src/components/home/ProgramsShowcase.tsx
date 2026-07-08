import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { getPrograms } from "@/content/programs";

export function ProgramsShowcase() {
  const programs = getPrograms();

  return (
    <Section elevated>
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader
            eyebrow="Training Programs"
            title="Structured chess training at every level"
            description="From a student's first move to professional tournament preparation."
          />
          <Button href="/programs" variant="outline" size="md" className="shrink-0">
            Explore All Programs
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.slug} program={program} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
