import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

/**
 * Renders when zero tournament records are published. Explains Phoenix's
 * competitive-development direction using already-confirmed/source-
 * supported content rather than saying "No tournaments available" or
 * leaving the page looking broken. No filter bar is shown alongside this
 * — filtering only makes sense once there's real data to filter.
 */
export function TournamentsEmptyState() {
  return (
    <Section surface>
      <Container className="rounded-2xl border border-border bg-surface p-8 text-center lg:p-14">
        <p className="text-caption text-primary-text mb-3">Tournaments</p>
        <h2 className="text-h2 text-foreground">
          Competitive play is built into the Phoenix curriculum
        </h2>
        <p className="text-body-lg text-muted-foreground mt-4 mx-auto max-w-2xl">
          Tournament preparation isn&apos;t a separate add-on at Phoenix —
          it&apos;s part of how students train from Tournament Preparation
          through Professional Chess Training. Specific tournament listings,
          registration windows, and results will be published here as they
          are confirmed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button href="/contact" variant="primary" size="lg">
            Contact Phoenix
          </Button>
          <Button href="/programs" variant="outline" size="lg">
            Explore Training Programs
          </Button>
          <Button href="/book-trial" variant="outline" size="lg">
            Book a Trial
          </Button>
        </div>
      </Container>
    </Section>
  );
}
