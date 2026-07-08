import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { TrialCTA } from "@/components/home/TrialCTA";
import { visionMissionDraft } from "@/content/about";

export const metadata = buildMetadata({
  title: "Vision & Mission",
  description: "Phoenix Chess Academy's training philosophy and long-term approach to student chess development.",
  path: "/about/vision-mission",
});

export default function VisionMissionPage() {
  return (
    <>
      <PageHero eyebrow="About Phoenix" title="Vision & Mission" />

      <Section>
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <p className="text-caption text-primary-text mb-3">Vision</p>
            <p className="text-h2 text-foreground">{visionMissionDraft.vision}</p>
          </div>
          <div>
            <p className="text-caption text-primary-text mb-3">Mission</p>
            <p className="text-h3 text-foreground">{visionMissionDraft.mission}</p>
          </div>
        </Container>
      </Section>

      <Section surface>
        <Container>
          <PointsGrid points={visionMissionDraft.principles} />
        </Container>
      </Section>

      <TrialCTA />
    </>
  );
}
