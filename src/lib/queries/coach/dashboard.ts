import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listCoachBatches, type CoachBatchListRow } from "@/lib/queries/coach/batches";
import { WEEKDAY_ORDER } from "@/lib/portal/weekday";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { Weekday } from "@/lib/supabase/types";

const DASHBOARD_SCHEDULE_PREVIEW_LIMIT = 7;

export interface CoachDashboardBatchCard extends CoachBatchListRow {
  /** Deduplicated count of students connected to this batch — never a raw row count that could double-count a student linked via both batch_enrollments and student_program_enrollments. */
  rosterCount: number;
}

export interface CoachDashboardScheduleRow {
  id: string;
  batchId: string;
  batchName: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface CoachDashboardData {
  batches: CoachDashboardBatchCard[];
  /** Deduplicated by student_id across ALL assigned batches — a student on two of the coach's batches is counted once. See docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Dashboard Query Strategy". */
  uniqueStudentCount: number;
  schedulePreview: CoachDashboardScheduleRow[];
  scheduleTotalCount: number;
}

/**
 * One dashboard query for a coach who may have multiple assigned
 * batches — built as a small number of *batched* relationship queries
 * (one for assigned batches via `listCoachBatches`, one batched `IN`
 * query each for `batch_enrollments`/`student_program_enrollments`
 * student IDs across all assigned batch IDs, one batched `IN` query for
 * schedules) rather than a per-batch loop. Only `student_id` is ever
 * selected from the enrollment tables here — no student PII is needed
 * for a count, so this never touches the `students` table or the
 * roster RPC.
 */
export async function getCoachDashboard(coachId: string): Promise<CoachQueryResult<CoachDashboardData>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const batchesResult = await listCoachBatches(coachId);
    if (!batchesResult.ok) return coachQueryUnknownError();

    const batchList = batchesResult.data;
    const batchIds = batchList.map((b) => b.id);

    if (batchIds.length === 0) {
      return coachQueryOk({ batches: [], uniqueStudentCount: 0, schedulePreview: [], scheduleTotalCount: 0 });
    }

    const supabase = await getServerSupabaseClient();

    const [batchEnrollmentsResult, programEnrollmentsResult, scheduleResult] = await Promise.all([
      supabase.from("batch_enrollments").select("student_id, batch_id").in("batch_id", batchIds as never),
      supabase.from("student_program_enrollments").select("student_id, batch_id").in("batch_id", batchIds as never),
      supabase
        .from("class_schedules")
        .select("id, batch_id, day_of_week, start_time, end_time, timezone, batches(name)")
        .in("batch_id", batchIds as never)
        .eq("active", true as never),
    ]);

    if (batchEnrollmentsResult.error || programEnrollmentsResult.error || scheduleResult.error) {
      return coachQueryUnknownError();
    }

    const studentIdsByBatch = new Map<string, Set<string>>();
    const allStudentIds = new Set<string>();

    for (const row of (batchEnrollmentsResult.data ?? []) as unknown as Array<{ student_id: string; batch_id: string }>) {
      const set = studentIdsByBatch.get(row.batch_id) ?? new Set<string>();
      set.add(row.student_id);
      studentIdsByBatch.set(row.batch_id, set);
      allStudentIds.add(row.student_id);
    }
    for (const row of (programEnrollmentsResult.data ?? []) as unknown as Array<{ student_id: string; batch_id: string | null }>) {
      if (!row.batch_id) continue;
      const set = studentIdsByBatch.get(row.batch_id) ?? new Set<string>();
      set.add(row.student_id);
      studentIdsByBatch.set(row.batch_id, set);
      allStudentIds.add(row.student_id);
    }

    const batches: CoachDashboardBatchCard[] = batchList.map((batch) => ({
      ...batch,
      rosterCount: studentIdsByBatch.get(batch.id)?.size ?? 0,
    }));

    const batchNameById = new Map(batchList.map((b) => [b.id, b.name]));

    const scheduleRows = ((scheduleResult.data ?? []) as unknown as Array<{
      id: string;
      batch_id: string;
      day_of_week: Weekday;
      start_time: string;
      end_time: string;
      timezone: string;
      batches: { name: string } | null;
    }>).map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      batchName: row.batches?.name ?? batchNameById.get(row.batch_id) ?? "—",
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
    }));

    scheduleRows.sort((a, b) => {
      const dayDiff = WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

    return coachQueryOk({
      batches,
      uniqueStudentCount: allStudentIds.size,
      schedulePreview: scheduleRows.slice(0, DASHBOARD_SCHEDULE_PREVIEW_LIMIT),
      scheduleTotalCount: scheduleRows.length,
    });
  } catch {
    return coachQueryUnavailable();
  }
}
