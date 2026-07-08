import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAchievements } from "@/content/achievements";

interface ProgramAchievementsProps {
  slug: string;
}

/**
 * Shows only achievements explicitly linked to this program via
 * `relatedProgramSlugs` — sourced from src/content/achievements.ts (the
 * same authoritative source as /achievements), referenced by program
 * slug rather than duplicating achievement objects inside
 * src/content/programs.ts. Renders nothing when there are none — no
 * generic filler, since a fabricated "relevant achievement" would be
 * misleading here more than most empty states.
 */
export function ProgramAchievements({ slug }: ProgramAchievementsProps) {
  const relevant = getAchievements().filter((achievement) => achievement.relatedProgramSlugs?.includes(slug));

  if (relevant.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Student Achievements" title="Results from students in this program" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relevant.slice(0, 3).map((achievement) => (
            <div key={achievement.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="relative aspect-4/3">
                <Image
                  src={achievement.image}
                  alt={achievement.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <p className="text-h4 text-foreground">{achievement.title}</p>
                {achievement.studentName ? (
                  <p className="text-body-sm text-primary-text mt-1">{achievement.studentName}</p>
                ) : null}
                <p className="text-body-sm text-muted-foreground mt-1">
                  {[achievement.tournamentName, achievement.year].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
