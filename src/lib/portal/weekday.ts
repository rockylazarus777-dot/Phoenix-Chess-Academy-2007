import type { Weekday } from "@/lib/supabase/types";

/**
 * Single authoritative weekday order for the student portal — mirrors
 * `public.weekday`'s declaration order in
 * supabase/migrations/0012_admin_operations_schema.sql exactly (Postgres
 * enums sort by declaration order, so a plain `ORDER BY day_of_week`
 * already comes back Monday-first, but this array is what the UI groups
 * and displays by, so it does not depend on that implicit DB behavior
 * being obvious to a future reader). Do not sort weekdays alphabetically
 * anywhere, and do not duplicate this list — every page importing a
 * weekday order uses this one.
 */
export const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/** "17:00:00" -> "5:00 PM". Falls back to the raw value if parsing fails, rather than throwing. */
export function formatTimeOfDay(time: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}
