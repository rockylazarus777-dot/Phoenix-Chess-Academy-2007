import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

/** Final conversion section — confident, no fake urgency or countdowns. */
export function TrialCTA() {
  return (
    <Section dark className="text-center border-t-2 border-primary">
      <Container>
        <p className="text-caption text-primary-text mb-4">Start Today</p>
        <h2 className="text-h1 text-foreground max-w-2xl mx-auto">
          Start your child&apos;s chess journey with Phoenix
        </h2>
        <p className="text-body-lg text-muted-foreground mt-4 max-w-xl mx-auto">
          Book a trial class and see the Phoenix training structure firsthand.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button href="/book-trial" variant="primary" size="lg">
            Book a Trial
          </Button>
          <Button href="/contact" variant="outline" size="lg">
            Contact Us
          </Button>
        </div>
      </Container>
    </Section>
  );
}
