import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";

interface GuidanceItem {
  label: string;
  description: string;
  recommended: { name: string; slug: string }[];
}

const guidanceItems: GuidanceItem[] = [
  {
    label: "New to Chess",
    description: "Never played, or only knows a few rules.",
    recommended: [{ name: "Beginner Chess", slug: "beginner-chess" }],
  },
  {
    label: "Knows the Rules and Plays Regularly",
    description: "Comfortable with the rules and plays casually or occasionally.",
    recommended: [{ name: "Intermediate Chess", slug: "intermediate-chess" }],
  },
  {
    label: "Competitive Player",
    description: "Has tournament or serious competitive experience already.",
    recommended: [
      { name: "Advanced Chess", slug: "advanced-chess" },
      { name: "Professional Chess Training", slug: "professional-training" },
    ],
  },
  {
    label: "Preparing for Tournaments",
    description: "Has a specific upcoming tournament to prepare for.",
    recommended: [{ name: "Tournament Preparation", slug: "tournament-preparation" }],
  },
  {
    label: "Needs Online Training",
    description: "Can't attend in person and needs remote training.",
    recommended: [{ name: "Online Chess Coaching", slug: "online-chess-coaching" }],
  },
];

/**
 * Lightweight self-guidance — not an assessment, quiz, or AI
 * recommendation engine. Each category simply points at the most
 * relevant program(s); a coach makes the real assessment at trial.
 */
export function ProgramDiscovery() {
  return (
    <Section surface>
      <Container>
        <SectionHeader
          eyebrow="Not Sure Where to Start?"
          title="Find a program based on where you are today"
          description="This is general guidance, not a formal assessment — a coach can evaluate your level directly during a trial class."
        />

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {guidanceItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-background p-6">
              <p className="text-h4 text-foreground">{item.label}</p>
              <p className="text-body-sm text-muted-foreground mt-2">{item.description}</p>
              <ul className="mt-4 space-y-1.5">
                {item.recommended.map((program) => (
                  <li key={program.slug}>
                    <Link href={`/programs/${program.slug}`} className="text-body-sm text-primary-text">
                      {program.name} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-body text-foreground mb-4">Still not sure which program fits?</p>
          <Button href="/book-trial" variant="primary" size="lg">
            Book a Trial
          </Button>
        </div>
      </Container>
    </Section>
  );
}
