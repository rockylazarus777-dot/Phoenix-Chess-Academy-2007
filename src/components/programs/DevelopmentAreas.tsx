import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { developmentAreaDescriptions } from "@/content/programs";

interface DevelopmentAreasProps {
  areas: string[];
}

/**
 * Editorial list of chess development areas relevant to a program — no
 * skill meters or fake percentage scores, since no measurement data
 * exists. Renders nothing if a program has no configured areas.
 */
export function DevelopmentAreas({ areas }: DevelopmentAreasProps) {
  if (areas.length === 0) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Curriculum Focus" title="Areas of chess development" />
        <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <div key={area} className="border-t border-border pt-5">
              <dt className="text-h4 text-foreground">{area}</dt>
              <dd className="text-body-sm text-muted-foreground mt-2">
                {developmentAreaDescriptions[area] ?? ""}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
