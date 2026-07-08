import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { WEEKDAY_ORDER } from "@/lib/portal/weekday";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { Weekday } from "@/lib/supabase/types";

export interface ParentStudentScheduleRow {
  id: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  timezone: string;
  batchName: string;
  batchCode: string;
}

/**
 * "Linked Student Class Schedule" — recurring `class_schedules`
 * definitions for one linked student's own batches (via either
 * `batch_enrollments` or a direct `student_program_enrollments.batch_id`,
 * matching the two linkage paths the RLS policy itself covers). NOT
 * attendance, NOT dated sessions. Grouped and ordered by
 * `WEEKDAY_ORDER` (reused as-is from `src/lib/portal/weekday.ts` — this
 * helper is a generic weekday-enum display map, not student-specific,
 * so reuse here does not cross the student/parent decoupling boundary).
 */
export async function getParentStudentSchedule(studentId: string): Promise<ParentQueryResult<ParentStudentScheduleRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();

    const [enrollmentBatches, batchAssignments] = await Promise.all([
      supabase.from("student_program_enrollments").select("batch_id").eq("student_id", studentId as never),
      supabase.from("batch_enrollments").select("batch_id").eq("student_id", studentId as never).eq("status", "ACTIVE" as never),
    ]);

    if (enrollmentBatches.error || batchAssignments.error) return parentQueryUnknownError();

    const batchIds = [
      ...new Set(
        [
          ...((enrollmentBatches.data ?? []) as unknown as Array<{ batch_id: string | null }>).map((r) => r.batch_id),
          ...((batchAssignments.data ?? []) as unknown as Array<{ batch_id: string }>).map((r) => r.batch_id),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    if (batchIds.length === 0) return parentQueryOk([]);

    const { data, error } = await supabase
      .from("class_schedules")
      .select("id, day_of_week, start_time, end_time, timezone, batches(batch_code, name)")
      .in("batch_id", batchIds as never)
      .eq("active", true as never);

    if (error) return parentQueryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      day_of_week: Weekday;
      start_time: string;
      end_time: string;
      timezone: string;
      batches: { batch_code: string; name: string } | null;
    }>).map((row) => ({
      id: row.id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      batchCode: row.batches?.batch_code ?? "—",
      batchName: row.batches?.name ?? "—",
    }));

    rows.sort((a, b) => {
      const dayDiff = WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

    return parentQueryOk(rows);
  } catch {
    return parentQueryUnavailable();
  }
}
