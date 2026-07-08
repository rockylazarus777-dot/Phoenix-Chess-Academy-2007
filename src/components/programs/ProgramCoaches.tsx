import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { coaches } from "@/content/coaches";

interface ProgramCoachesProps {
  slug: string;
}

/**
 * Shows coaches explicitly linked to this program. Falls back to a CTA
 * pointing at /coaches (an honest academy-level fallback) rather than
 * hiding entirely, since "meet the coaches" is a reasonable next step
 * even without a confirmed per-program assignment.
 */
export function ProgramCoaches({ slug }: ProgramCoachesProps) {
  const relevant = coaches.filter((coach) => coach.active && coach.relatedProgramSlugs?.includes(slug));

  if (relevant.length === 0) {
    return (
      <Section surface>
        <Container className="text-center">
          <SectionHeader
            eyebrow="Coaches"
            title="Coaching built around each student's development"
            description="Coach assignments for this program are confirmed directly with the academy."
            align="center"
            className="mx-auto"
          />
          <div className="mt-8">
            <Button href="/coaches" variant="outline" size="md">
              Meet the Coaches
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Coaches" title="Coaches for this program" />
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {relevant.map((coach) => (
            <div key={coach.id} className="text-center">
              <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-full border border-border-strong">
                <Image src={coach.image} alt={coach.name} fill sizes="128px" className="object-cover" />
              </div>
              <p className="text-h4 text-foreground mt-4">{coach.name}</p>
              {coach.chessTitle ? <p className="text-caption text-primary-text mt-1">{coach.chessTitle}</p> : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
