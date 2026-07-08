import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProgramCard } from "@/components/programs/ProgramCard";
import type { Program } from "@/content/programs";

interface RelatedProgramsProps {
  programs: Program[];
}

/** Renders nothing when a program has no valid related programs. */
export function RelatedPrograms({ programs }: RelatedProgramsProps) {
  if (programs.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Related Programs" title="Continue your training pathway" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.slug} program={program} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
