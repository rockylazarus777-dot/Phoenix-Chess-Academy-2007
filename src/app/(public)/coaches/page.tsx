import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { CoachCard } from "@/components/coaches/CoachCard";
import { TrialCTA } from "@/components/home/TrialCTA";
import { coaches } from "@/content/coaches";

export const metadata = buildMetadata({
  title: "Coaches",
  description: "Phoenix Chess Academy's approach to coaching — individual student development from certified, experienced coaches.",
  path: "/coaches",
});

const coachingApproach = [
  {
    title: "Individual Development Focus",
    description: "Coaches track each student's progress individually, rather than teaching a single fixed lesson to everyone.",
  },
  {
    title: "Coach Selection Philosophy",
    description: "Coaches are placed with students based on level and training goals — beginner, competitive, or tournament-focused.",
  },
  {
    title: "Structured Methodology",
    description: "Every coach follows the same structured Phoenix curriculum, so a student's progress is consistent across levels.",
  },
];

export default function CoachesPage() {
  const activeCoaches = coaches.filter((coach) => coach.active);

  return (
    <>
      <PageHero
        eyebrow="Meet Our Coaches"
        title="Coaching built around each student's development"
        description="Phoenix coaches work with students individually — tracking progress, adjusting training, and preparing players for real competition."
      />

      {activeCoaches.length === 0 ? (
        <EmptyDataState
          title="Coach profiles are being finalized"
          description="The Phoenix coaching roster will be published here once profiles are confirmed. Our coaching approach is outlined below."
        />
      ) : (
        <Section>
          <Container className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeCoaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </Container>
        </Section>
      )}

      <Section surface>
        <Container>
          <SectionHeader eyebrow="Our Approach" title="How Phoenix coaches work with students" />
          <div className="mt-12">
            <PointsGrid points={coachingApproach} columns={3} />
          </div>
        </Container>
      </Section>

      <TrialCTA />
    </>
  );
}
