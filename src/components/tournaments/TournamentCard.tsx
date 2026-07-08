import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTournamentDateRange } from "@/lib/dates";
import { isRegistrationOpenNow, type Tournament } from "@/content/tournaments";

interface TournamentCardProps {
  tournament: Tournament;
  /** Only an above-the-fold card should ever set this true. */
  priority?: boolean;
}

/**
 * The single TournamentCard used everywhere a tournament is shown as a
 * card. Only renders configured fields — no fake participant counts or
 * urgency messaging ("Only 3 seats left!").
 */
export function TournamentCard({ tournament, priority = false }: TournamentCardProps) {
  const location = [tournament.venueName, tournament.city].filter(Boolean).join(", ");
  const registrationOpen = isRegistrationOpenNow(tournament);

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <Link href={`/tournaments/${tournament.slug}`} className="block" tabIndex={-1}>
        <div className="relative aspect-4/3 overflow-hidden">
          <Image
            src={tournament.cardImage}
            alt={tournament.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            style={tournament.imagePosition ? { objectPosition: tournament.imagePosition } : undefined}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusBadge status={tournament.status} />
          <p className="text-caption text-muted-foreground">{tournament.tournamentType}</p>
        </div>

        <Link href={`/tournaments/${tournament.slug}`}>
          <h3 className="text-h4 text-foreground group-hover:text-primary-text transition-colors">{tournament.name}</h3>
        </Link>

        <p className="text-body-sm text-muted-foreground mt-2">
          <time dateTime={tournament.startDate}>
            {formatTournamentDateRange(tournament.startDate, tournament.endDate)}
          </time>
        </p>
        {location ? <p className="text-body-sm text-muted-foreground">{location}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={`/tournaments/${tournament.slug}`} variant="outline" size="sm">
            View Tournament
          </Button>
          {registrationOpen ? (
            <Button href={`/tournaments/${tournament.slug}/register`} variant="primary" size="sm">
              Register
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
