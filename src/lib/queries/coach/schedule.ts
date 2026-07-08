import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { WEEKDAY_ORDER } from "@/lib/portal/weekday";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { TrainingMode, Weekday } from "@/lib/supabase/types";

export interface CoachBatchScheduleRow {
  id: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  timezone: string;
  trainingMode: TrainingMode;
  locationName: string | null;
}

/**
 * "Assigned Batch Class Schedule" — recurring `class_schedules`
 * definitions for one assigned batch, using the authenticated
 * (RLS-scoped) server client. `batchId` must already have passed
 * `getAssignedBatch()` authorization at the page level. NOT
 * attendance, NOT dated sessions. Reuses `WEEKDAY_ORDER` from
 * `src/lib/portal/weekday.ts` directly — a generic weekday-enum
 * display map, not student/parent-specific, so reuse here does not
 * cross the coach portal's decoupling boundary.
 */
export async function getCoachBatchSchedule(batchId: string): Promise<CoachQueryResult<CoachBatchScheduleRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("class_schedules")
      .select("id, day_of_week, start_time, end_time, timezone, batches!inner(training_mode, academy_locations(name))")
      .eq("batch_id", batchId as never)
      .eq("active", true as never);

    if (error) return coachQueryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      day_of_week: Weekday;
      start_time: string;
      end_time: string;
      timezone: string;
      batches: { training_mode: TrainingMode; academy_locations: { name: string } | null } | null;
    }>).map((row) => ({
      id: row.id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      trainingMode: row.batches?.training_mode ?? "OFFLINE",
      locationName: row.batches?.academy_locations?.name ?? null,
    }));

    rows.sort((a, b) => {
      const dayDiff = WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

    return coachQueryOk(rows);
  } catch {
    return coachQueryUnavailable();
  }
}
