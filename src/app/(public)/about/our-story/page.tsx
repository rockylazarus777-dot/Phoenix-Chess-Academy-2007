import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Timeline } from "@/components/ui/Timeline";
import { TrialCTA } from "@/components/home/TrialCTA";
import { storyIntro, storyMilestones } from "@/content/about";

export const metadata = buildMetadata({
  title: "Our Story",
  description: "The Phoenix Chess Academy story — training milestones and academy growth, published as they're confirmed.",
  path: "/about/our-story",
});

export default function OurStoryPage() {
  return (
    <>
      <PageHero eyebrow="About Phoenix" title={storyIntro.heading} />

      <Section>
        <Container className="max-w-2xl">
          <p className="text-body-lg text-muted-foreground">{storyIntro.body}</p>
        </Container>
      </Section>

      {storyMilestones.length > 0 ? (
        <Section surface>
          <Container className="max-w-2xl">
            <Timeline entries={storyMilestones} />
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
