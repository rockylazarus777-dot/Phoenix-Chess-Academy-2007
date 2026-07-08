import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { formatTournamentDate } from "@/lib/dates";
import { isRegistrationOpenNow, type Tournament } from "@/content/tournaments";

interface TournamentRegistrationInfoProps {
  tournament: Tournament;
}

/**
 * Registration facts + CTA on the tournament detail page (not the
 * registration form itself, which lives at /tournaments/[slug]/register).
 * Entry fee is only shown when actually configured — never "Free" or
 * "Contact for Price" as an invented default.
 */
export function TournamentRegistrationInfo({ tournament }: TournamentRegistrationInfoProps) {
  const registrationOpen = isRegistrationOpenNow(tournament);
  const facts: { label: string; value: string }[] = [];

  if (tournament.registrationOpenDate) {
    facts.push({ label: "Registration Opens", value: formatTournamentDate(tournament.registrationOpenDate) });
  }
  if (tournament.registrationCloseDate) {
    facts.push({ label: "Registration Closes", value: formatTournamentDate(tournament.registrationCloseDate) });
  }
  if (typeof tournament.entryFee === "number") {
    facts.push({ label: "Entry Fee", value: `${tournament.currency ?? "INR"} ${tournament.entryFee}` });
  }
  if (typeof tournament.maxParticipants === "number") {
    facts.push({ label: "Maximum Participants", value: String(tournament.maxParticipants) });
  }

  if (facts.length === 0 && !tournament.registrationEnabled && !tournament.registrationUrl) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Registration" title="Registration information" />

        {facts.length > 0 ? (
          <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="border-t border-border pt-4">
                <dt className="text-caption text-muted-foreground">{fact.label}</dt>
                <dd className="text-body text-foreground mt-1">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-4">
          {registrationOpen ? (
            <Button href={`/tournaments/${tournament.slug}/register`} variant="primary" size="lg">
              Register Now
            </Button>
          ) : tournament.registrationUrl ? (
            <Button href={tournament.registrationUrl} variant="primary" size="lg" target="_blank" rel="noopener noreferrer">
              Register Externally
            </Button>
          ) : (
            <Button href={`/tournaments/${tournament.slug}/register`} variant="outline" size="lg">
              Registration Details
            </Button>
          )}
        </div>
      </Container>
    </Section>
  );
}
