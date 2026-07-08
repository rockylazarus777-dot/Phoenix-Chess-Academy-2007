/**
 * Authoritative tournament data — the single source of truth for the
 * public tournament system (/tournaments, /tournaments/[slug],
 * /tournaments/[slug]/register, /tournaments/[slug]/results).
 *
 * NO FAKE TOURNAMENT DATA: no tournament records have been supplied yet,
 * so `tournaments` is intentionally an empty array. Do not invent
 * tournament names, dates, venues, fees, participant counts, arbiters,
 * categories, rules, prizes, sponsors, winners, or results. Every page
 * that consumes this data renders an honest, on-brand empty/status-aware
 * state instead of fabricated content — see the tournament components in
 * src/components/tournaments/.
 *
 * Migration note (future Supabase move): this file's shape is designed
 * to map onto a relational schema — `tournaments` as the parent table,
 * `categories`/`schedule`/`rules`/`documents`/`results`/`winners`/`faq`
 * as child tables keyed by tournament id. `getTournamentBySlug` already
 * resolves by slug and the `[slug]` route already calls `notFound()` for
 * anything unrecognized, so swapping the lookup to a Supabase query is a
 * localized change here — page components don't need to change.
 */

/**
 * Reuses the existing Phase 3 status convention (SCREAMING_CASE) from
 * `src/components/ui/StatusBadge.tsx` rather than inventing a second,
 * differently-cased status system — `StatusBadge` now imports this type
 * and its labels from here instead of defining its own copy. Extended
 * with DRAFT and CANCELLED for the full Phase 6 tournament lifecycle.
 */
export type TournamentStatus =
  | "DRAFT"
  | "UPCOMING"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";

/**
 * User-facing labels for each status. Status must always be communicated
 * with this text label, never with color alone (e.g. do not rely on "red
 * badge = closed" without the word "Cancelled"/"Completed" also present).
 */
export const tournamentStatusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  LIVE: "Live / Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function getTournamentStatusLabel(status: TournamentStatus): string {
  return tournamentStatusLabels[status];
}

export interface TournamentCategory {
  id: string;
  name: string;
  description?: string;
  ageMin?: number;
  ageMax?: number;
  genderRestriction?: string;
  ratingMin?: number;
  ratingMax?: number;
  entryFee?: number;
  maxParticipants?: number;
  registrationOpen?: boolean;
}

export interface TournamentScheduleItem {
  /** ISO date, e.g. "2026-11-14". */
  date: string;
  time?: string;
  title: string;
  description?: string;
}

export interface TournamentRuleSection {
  title: string;
  body: string;
}

export interface TournamentDocument {
  title: string;
  url: string;
  /** e.g. "PDF", "Link" — display label, not an enforced enum. */
  type: string;
  fileSize?: string;
  /** True when `url` points off-site — used to add rel="noopener noreferrer". */
  external?: boolean;
}

export interface TournamentResultRow {
  rank: number;
  playerName: string;
  categoryId?: string;
  score: string;
  /** Supports multiple named tie-break values, e.g. "Buchholz: 24.5". */
  tieBreaks?: string;
  rating?: number;
  federation?: string;
  state?: string;
  prize?: string;
}

export interface TournamentWinner {
  playerName: string;
  /** e.g. "1st Place", "Best Under-14" — free text, not a fixed enum. */
  position: string;
  categoryId?: string;
  photo?: string;
  achievement?: string;
  rating?: number;
}

export interface TournamentFaqItem {
  question: string;
  answer: string;
}

export interface TournamentHighlight {
  label: string;
  value: string;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  description: string;
  status: TournamentStatus;
  /** e.g. "State Tournament", "Academy Tournament", "Open Tournament", "Student Tournament". */
  tournamentType: string;
  level?: string;

  /** ISO date. */
  startDate: string;
  /** ISO date — omit for a single-day tournament. */
  endDate?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  /** IANA timezone, e.g. "Asia/Kolkata" — preserved as configured, never converted. */
  timezone?: string;

  venueName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  mapUrl?: string;

  heroImage?: string;
  cardImage: string;
  imagePosition?: string;

  organizer?: string;
  chiefArbiter?: string;
  contact?: string;

  categories?: TournamentCategory[];

  registrationEnabled: boolean;
  /** External registration link, if registration is handled off-site instead of the internal form. */
  registrationUrl?: string;
  entryFee?: number;
  currency?: string;
  maxParticipants?: number;
  registeredParticipants?: number;

  schedule?: TournamentScheduleItem[];
  rules?: TournamentRuleSection[];
  documents?: TournamentDocument[];
  highlights?: TournamentHighlight[];

  results?: TournamentResultRow[];
  winners?: TournamentWinner[];
  gallery?: string[];
  faq?: TournamentFaqItem[];

  relatedSlugs?: string[];
  featured?: boolean;
  active: boolean;

  seoTitle?: string;
  seoDescription?: string;
}

/**
 * No tournament records have been supplied yet — this stays empty by
 * design. See PHOENIX_REAL_CONTENT_MASTER.md, Section 22 (Owner
 * Confirmation Register) for exactly what's needed before any tournament
 * can be added here.
 */
export const tournaments: Tournament[] = [];

export function getTournaments(): Tournament[] {
  return tournaments.filter((tournament) => tournament.active);
}

export function getTournamentBySlug(slug: string): Tournament | undefined {
  return tournaments.find((tournament) => tournament.active && tournament.slug === slug);
}

export function getFeaturedTournament(): Tournament | undefined {
  return getTournaments().find((tournament) => tournament.featured);
}

export function getTournamentsByStatus(status: TournamentStatus): Tournament[] {
  return getTournaments().filter((tournament) => tournament.status === status);
}

export function isRegistrationOpenNow(tournament: Tournament): boolean {
  return tournament.registrationEnabled && tournament.status === "REGISTRATION_OPEN";
}

export function hasMeaningfulResults(tournament: Tournament): boolean {
  return Boolean(tournament.results && tournament.results.length > 0);
}

export function getRelatedTournaments(tournament: Tournament, max = 3): Tournament[] {
  const active = getTournaments();
  return (tournament.relatedSlugs ?? [])
    .map((slug) => active.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is Tournament => Boolean(candidate) && candidate!.slug !== tournament.slug)
    .slice(0, max);
}
