import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { getFeaturedAchievements, getAchievements } from "@/content/achievements";

/**
 * No real achievement data has been supplied yet. Rather than publish
 * invented students/ratings/wins, this renders an honest introduction
 * section with a CTA to the full achievements page. Once
 * src/content/achievements.ts is populated, the real grid renders
 * automatically — featured achievements first, falling back to the most
 * recent active ones so this preview always shows at most 6.
 */
export function AchievementsShowcase() {
  const featured = getFeaturedAchievements();
  const achievements = featured.length > 0 ? featured : getAchievements();

  if (achievements.length === 0) {
    return (
      <Section dark>
        <Container className="text-center">
          <SectionHeader
            eyebrow="Student Achievements"
            title="Real results from real students"
            description="Tournament wins, rating milestones, and competitive results from Phoenix students — published here as results come in."
            align="center"
            className="mx-auto"
          />
          <div className="mt-8">
            <Button href="/achievements" variant="outline" size="md">
              View Achievements
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section dark>
      <Container>
        <SectionHeader eyebrow="Student Achievements" title="Real results from real students" />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.slice(0, 6).map((achievement) => (
            <div
              key={achievement.id}
              className="rounded-2xl border border-border bg-surface overflow-hidden transition-colors hover:border-primary/50"
            >
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
