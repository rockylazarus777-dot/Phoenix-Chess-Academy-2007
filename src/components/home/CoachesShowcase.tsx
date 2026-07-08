import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { coaches } from "@/content/coaches";

/**
 * No real coach roster has been supplied yet — rather than invent titles,
 * FIDE ratings, or names, this renders the academy's coaching philosophy
 * with a CTA to /coaches. Once `coaches` in content/coaches.ts is populated
 * with real data, the real coach grid renders automatically.
 */
export function CoachesShowcase() {
  if (coaches.length === 0) {
    return (
      <Section>
        <Container className="text-center">
          <SectionHeader
            eyebrow="Meet Our Coaches"
            title="Coaching built around each student's development"
            description="Phoenix coaches work with students individually — tracking progress, adjusting training, and preparing players for real competition."
            align="center"
            className="mx-auto"
          />
          <div className="mt-8">
            <Button href="/coaches" variant="outline" size="md">
              Meet the Coaches
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Meet Our Coaches" title="The people behind Phoenix training" />
        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {coaches.map((coach) => (
            <div key={coach.name} className="text-center">
              <div className="relative mx-auto aspect-square w-full max-w-40 overflow-hidden rounded-2xl border border-border">
                <Image src={coach.image} alt={coach.name} fill sizes="160px" className="object-cover" />
              </div>
              <p className="text-h4 text-foreground mt-4">{coach.name}</p>
              <p className="text-body-sm text-muted-foreground">{coach.role}</p>
              {coach.chessTitle ? <p className="text-caption text-primary-text mt-1">{coach.chessTitle}</p> : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
