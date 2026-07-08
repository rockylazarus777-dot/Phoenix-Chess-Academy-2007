import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface SkillsListProps {
  skills: string[];
}

/** Concise, program-specific skills list — no decorative per-item icons. */
export function SkillsList({ skills }: SkillsListProps) {
  if (skills.length === 0) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Skills" title="What students develop in this program" />
        <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
          {skills.map((skill) => (
            <li key={skill} className="text-body text-foreground/90 border-l-2 border-primary pl-4">
              {skill}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
