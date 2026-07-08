import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTournamentDateRange } from "@/lib/dates";
import { hasMeaningfulResults, isRegistrationOpenNow, type Tournament } from "@/content/tournaments";

interface TournamentHeroProps {
  tournament: Tournament;
  breadcrumbItems: BreadcrumbItem[];
}

/**
 * Tournament detail hero — real Phoenix tournament photography only, no
 * clipart trophies, flames, or confetti. Registration/results CTAs only
 * appear when actually applicable to the tournament's current state.
 */
export function TournamentHero({ tournament, breadcrumbItems }: TournamentHeroProps) {
  const location = [tournament.venueName, tournament.city, tournament.state].filter(Boolean).join(", ");
  const registrationOpen = isRegistrationOpenNow(tournament);
  const showResultsCta = hasMeaningfulResults(tournament);
  const heroSrc = tournament.heroImage ?? tournament.cardImage;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10">
        <Image
          src={heroSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          style={tournament.imagePosition ? { objectPosition: tournament.imagePosition } : undefined}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      </div>

      <Container className="py-16 lg:py-24">
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <StatusBadge status={tournament.status} />
          <p className="text-caption text-muted-foreground">{tournament.tournamentType}</p>
        </div>

        <h1 className="text-h1 text-foreground max-w-2xl">{tournament.name}</h1>
        <p className="text-body-lg text-muted-foreground mt-5 max-w-xl">{tournament.description}</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-muted-foreground">
          <p>
            <time dateTime={tournament.startDate}>
              {formatTournamentDateRange(tournament.startDate, tournament.endDate)}
            </time>
          </p>
          {location ? <p>{location}</p> : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          {registrationOpen ? (
            <Button href={`/tournaments/${tournament.slug}/register`} variant="primary" size="lg">
              Register Now
            </Button>
          ) : null}
          {showResultsCta ? (
            <Button href={`/tournaments/${tournament.slug}/results`} variant="outline" size="lg">
              View Results
            </Button>
          ) : null}
          <Button href="/tournaments" variant="outline" size="lg">
            Back to Tournaments
          </Button>
        </div>
      </Container>
    </section>
  );
}
