import { siteConfig, getSiteUrl } from "@/config/site";
import type { Tournament, TournamentStatus } from "@/content/tournaments";

/**
 * Event JSON-LD for a tournament detail page. Only includes fields that
 * are actually configured — no invented `offers`, `price`,
 * `availability`, `performer`, `sponsor`, or `maximumAttendeeCapacity`.
 * `location` (Place/PostalAddress) is only included when venue/address
 * data is actually configured on the tournament.
 */

const eventStatusMap: Record<TournamentStatus, string> = {
  DRAFT: "https://schema.org/EventScheduled",
  UPCOMING: "https://schema.org/EventScheduled",
  REGISTRATION_OPEN: "https://schema.org/EventScheduled",
  REGISTRATION_CLOSED: "https://schema.org/EventScheduled",
  LIVE: "https://schema.org/EventScheduled",
  COMPLETED: "https://schema.org/EventScheduled",
  CANCELLED: "https://schema.org/EventCancelled",
};

export function buildTournamentEventSchema(tournament: Tournament) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/tournaments/${tournament.slug}`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: tournament.name,
    description: tournament.description,
    startDate: tournament.startDate,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: eventStatusMap[tournament.status],
    url,
  };

  if (tournament.endDate) schema.endDate = tournament.endDate;

  const hasVenue = Boolean(tournament.venueName || tournament.address || tournament.city);
  if (hasVenue) {
    schema.location = {
      "@type": "Place",
      name: tournament.venueName || tournament.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: tournament.address || undefined,
        addressLocality: tournament.city || undefined,
        addressRegion: tournament.state || undefined,
        addressCountry: tournament.country || undefined,
      },
    };
  }

  schema.organizer = tournament.organizer
    ? { "@type": "Organization", name: tournament.organizer, url: siteUrl }
    : { "@type": "Organization", name: siteConfig.name, url: siteUrl };

  return schema;
}
