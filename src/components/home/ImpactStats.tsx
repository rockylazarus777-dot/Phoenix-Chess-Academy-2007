import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { StatCounter } from "@/components/home/StatCounter";
import { trustStats } from "@/content/home";

/**
 * Renders whatever confirmed stats exist in content/home.ts — one or six,
 * without needing a redesign. Section is entirely omitted if no stat has
 * been confirmed yet, rather than showing "00+" / "XX+" placeholders.
 */
export function ImpactStats() {
  if (trustStats.length === 0) return null;

  return (
    <Section dark>
      <Container>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {trustStats.map((stat) => (
            <StatCounter key={stat.id} value={stat.value} suffix={stat.suffix} label={stat.label} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
