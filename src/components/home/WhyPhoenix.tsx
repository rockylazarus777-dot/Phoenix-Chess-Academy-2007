import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { whyPhoenixPoints } from "@/content/home";

export function WhyPhoenix() {
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Why Choose Phoenix"
          title="What makes Phoenix training different"
          align="left"
        />
        <div className="mt-12">
          <PointsGrid points={whyPhoenixPoints} />
        </div>
      </Container>
    </Section>
  );
}
