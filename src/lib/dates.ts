/**
 * Centralized date-formatting helpers — used everywhere a tournament
 * date needs to be displayed, so formatting never drifts between
 * components. Do not format dates ad hoc inside individual components;
 * import from here instead.
 *
 * All inputs are ISO date strings (e.g. "2026-11-14"). No timezone
 * conversion is invented — if a tournament configures a `timezone`
 * field, that value is preserved and displayed alongside the date
 * rather than used to shift the stored date/time.
 */

const DATE_LOCALE = "en-IN";

export function formatTournamentDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

export function formatTournamentDateShort(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Formats a single date, or a range when `endIso` differs from
 * `startIso` — collapsing the range to "14–16 November 2026" when both
 * dates fall in the same month/year, and spelling out both dates
 * otherwise.
 */
export function formatTournamentDateRange(startIso: string, endIso?: string): string {
  if (!endIso || endIso === startIso) return formatTournamentDate(startIso);

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return formatTournamentDate(startIso);

  const sameMonthYear = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonthYear) {
    const startDay = start.toLocaleDateString(DATE_LOCALE, { day: "numeric" });
    const endLabel = end.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "long", year: "numeric" });
    return `${startDay}–${endLabel}`;
  }

  return `${formatTournamentDate(startIso)} – ${formatTournamentDate(endIso)}`;
}

/** True when a tournament spans more than one calendar day. */
export function isMultiDay(startIso: string, endIso?: string): boolean {
  return Boolean(endIso && endIso !== startIso);
}
