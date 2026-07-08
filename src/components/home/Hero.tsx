import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { HeroVisual } from "@/components/home/HeroVisual";

/**
 * Home page hero. Warm Ivory, spacious, editorial two-column layout —
 * headline and CTAs on the left, academy visual on the right (see
 * HeroVisual for the real-photo/branded-fallback logic).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-16 lg:py-24">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-caption text-primary-text mb-4">Phoenix Chess Academy</p>
          <h1 className="text-display text-accent">
            Think Ahead.
            <br />
            Play Beyond.
            <br />
            Become a <span className="text-primary">Champion.</span>
          </h1>
          <p className="text-body-lg text-muted-foreground mt-6 max-w-lg">
            Structured chess coaching, competitive training, and tournament
            preparation for students building real, disciplined chess skill.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button href="/book-trial" variant="primary" size="lg">
              Book a Trial
            </Button>
            <Button href="/programs" variant="outline" size="lg">
              Explore Programs
            </Button>
          </div>
        </div>

        <HeroVisual
          src="/images/home/hero/hero-desktop.webp"
          alt="Students training at Phoenix Chess Academy"
        />
      </Container>
    </section>
  );
}
