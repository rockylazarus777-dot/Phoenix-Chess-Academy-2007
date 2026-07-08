import Image from "next/image";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getAchievements, getFeaturedAchievements, getAchievementsByType, type Achievement } from "@/content/achievements";
import { trainingMethodology } from "@/content/training";

export const metadata = buildMetadata({
  title: "Student Achievements",
  description: "Real tournament results, rating milestones, and competitive achievements from Phoenix Chess Academy students.",
  path: "/achievements",
});

function AchievementGrid({ items }: { items: Achievement[] }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((achievement) => (
        <div key={achievement.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="relative aspect-4/3">
            <Image
              src={achievement.image}
              alt={achievement.imageAlt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
          <div className="p-5">
            <p className="text-h4 text-foreground">{achievement.title}</p>
            {achievement.studentName ? (
              <p className="text-body-sm text-primary-text mt-1">{achievement.studentName}</p>
            ) : null}
            <p className="text-body-sm text-muted-foreground mt-2">{achievement.description}</p>
            {achievement.tournamentName || achievement.year ? (
              <p className="text-caption text-muted-foreground mt-3">
                {[achievement.tournamentName, achievement.placement, achievement.year].filter(Boolean).join(" — ")}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AchievementsPage() {
  const allAchievements = getAchievements();
  const featured = getFeaturedAchievements();
  const studentAchievements = getAchievementsByType("STUDENT");
  const academyMilestones = getAchievementsByType("ACADEMY");
  const tournamentAchievements = getAchievementsByType("TOURNAMENT");

  const competitiveDevelopmentItem = trainingMethodology.find((item) => item.id === "tournament-experience");

  return (
    <>
      <PageHero
        eyebrow="Achievements"
        title="Student Achievements"
        description="Tournament results, rating milestones, and competitive results from Phoenix Chess Academy students."
      />

      {allAchievements.length === 0 ? (
        <EmptyDataState
          eyebrow="Phoenix Achievements"
          title="Real results, published as they come in"
          description="Phoenix Chess Academy trains students to compete, not just to learn rules — tournament experience is treated as part of the curriculum. Verified student results, rating milestones, and tournament achievements will be published here as structured records become available."
          ctaLabel="Book a Trial"
          ctaHref="/book-trial"
        />
      ) : (
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Phoenix Achievements"
              title="Real results from real students"
              description="Phoenix trains students to compete, not just to learn rules — tournament experience is treated as part of the curriculum."
            />
          </Container>
        </Section>
      )}

      {featured.length > 0 ? (
        <Section surface>
          <Container>
            <SectionHeader eyebrow="Featured" title="Featured Achievements" />
            <AchievementGrid items={featured} />
          </Container>
        </Section>
      ) : null}

      {studentAchievements.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader eyebrow="Students" title="Student Achievements" />
            <AchievementGrid items={studentAchievements} />
          </Container>
        </Section>
      ) : null}

      {academyMilestones.length > 0 ? (
        <Section surface>
          <Container>
            <SectionHeader eyebrow="Academy" title="Academy Milestones" />
            <AchievementGrid items={academyMilestones} />
          </Container>
        </Section>
      ) : null}

      {tournamentAchievements.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader eyebrow="Tournaments" title="Tournament Achievements" />
            <AchievementGrid items={tournamentAchievements} />
          </Container>
        </Section>
      ) : null}

      {competitiveDevelopmentItem ? (
        <Section surface>
          <Container className="max-w-2xl text-center mx-auto">
            <p className="text-caption text-primary-text mb-3">Competitive Development</p>
            <h2 className="text-h2 text-foreground">{competitiveDevelopmentItem.title}</h2>
            <p className="text-body-lg text-muted-foreground mt-4">{competitiveDevelopmentItem.description}</p>
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
