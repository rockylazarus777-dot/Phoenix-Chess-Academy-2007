import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

interface ProgramOverviewProps {
  description: string;
}

export function ProgramOverview({ description }: ProgramOverviewProps) {
  return (
    <Section className="pb-0">
      <Container>
        <p className="text-body-lg text-muted-foreground max-w-2xl">{description}</p>
      </Container>
    </Section>
  );
}
