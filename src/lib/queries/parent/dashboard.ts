import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { WEEKDAY_ORDER } from "@/lib/portal/weekday";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentRelationship, StudentStatus, TrainingMode, Weekday } from "@/lib/supabase/types";

const DASHBOARD_STUDENT_PREVIEW_LIMIT = 4;
const DASHBOARD_SCHEDULE_PREVIEW_LIMIT = 7;

export interface ParentDashboardStudentCard {
  studentId: string;
  studentCode: string;
  fullName: string;
  currentLevel: string | null;
  status: StudentStatus;
  relationship: ParentRelationship;
  isPrimary: boolean;
  programNames: string[];
  batches: Array<{ batchName: string; programName: string; trainingMode: TrainingMode }>;
}

export interface ParentDashboardScheduleRow {
  id: string;
  studentId: string;
  studentFirstName: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  timezone: string;
  batchName: string;
}

export interface ParentDashboardData {
  students: ParentDashboardStudentCard[];
  studentsTotalCount: number;
  schedulePreview: ParentDashboardScheduleRow[];
  scheduleTotalCount: number;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * One dashboard query for a parent who may have multiple linked
 * students — deliberately built as a small number of *batched*
 * relationship queries (one for links, one for active program
 * enrollments across all linked student IDs, one for active batch
 * enrollments across all linked student IDs, one for schedules across
 * the resulting batch IDs) rather than a per-student loop. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Dashboard Database
 * Strategy".
 */
export async function getParentDashboard(parentId: string): Promise<ParentQueryResult<ParentDashboardData>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();

    const { data: linkData, error: linkError } = await supabase
      .from("student_parents")
      .select("relationship, is_primary, students(id, student_code, full_name, current_level, status)")
      .eq("parent_id", parentId as never);

    if (linkError) return parentQueryUnknownError();

    const links = ((linkData ?? []) as unknown as Array<{
      relationship: ParentRelationship;
      is_primary: boolean;
      students: {
        id: string;
        student_code: string;
        full_name: string;
        current_level: string | null;
        status: StudentStatus;
      } | null;
    }>).filter((link) => link.students !== null);

    const studentIds = links.map((link) => link.students!.id);

    if (studentIds.length === 0) {
      return parentQueryOk({ students: [], studentsTotalCount: 0, schedulePreview: [], scheduleTotalCount: 0 });
    }

    const [programsResult, batchesResult] = await Promise.all([
      supabase
        .from("student_program_enrollments")
        .select("student_id, programs(name)")
        .in("student_id", studentIds as never)
        .eq("status", "ACTIVE" as never),
      supabase
        .from("batch_enrollments")
        .select("student_id, batch_id, batches(name, training_mode, programs(name))")
        .in("student_id", studentIds as never)
        .eq("status", "ACTIVE" as never),
    ]);

    if (programsResult.error || batchesResult.error) return parentQueryUnknownError();

    const programNamesByStudent = new Map<string, string[]>();
    for (const row of (programsResult.data ?? []) as unknown as Array<{
      student_id: string;
      programs: { name: string } | null;
    }>) {
      if (!row.programs?.name) continue;
      const list = programNamesByStudent.get(row.student_id) ?? [];
      list.push(row.programs.name);
      programNamesByStudent.set(row.student_id, list);
    }

    const batchesByStudent = new Map<string, Array<{ batchName: string; programName: string; trainingMode: TrainingMode }>>();
    const batchToStudentIds = new Map<string, Set<string>>();

    for (const row of (batchesResult.data ?? []) as unknown as Array<{
      student_id: string;
      batch_id: string;
      batches: { name: string; training_mode: TrainingMode; programs: { name: string } | null } | null;
    }>) {
      const list = batchesByStudent.get(row.student_id) ?? [];
      list.push({
        batchName: row.batches?.name ?? "—",
        programName: row.batches?.programs?.name ?? "—",
        trainingMode: (row.batches?.training_mode ?? "OFFLINE") as TrainingMode,
      });
      batchesByStudent.set(row.student_id, list);

      const studentSet = batchToStudentIds.get(row.batch_id) ?? new Set<string>();
      studentSet.add(row.student_id);
      batchToStudentIds.set(row.batch_id, studentSet);
    }

    const students: ParentDashboardStudentCard[] = links.map((link) => ({
      studentId: link.students!.id,
      studentCode: link.students!.student_code,
      fullName: link.students!.full_name,
      currentLevel: link.students!.current_level,
      status: link.students!.status,
      relationship: link.relationship,
      isPrimary: link.is_primary,
      programNames: programNamesByStudent.get(link.students!.id) ?? [],
      batches: batchesByStudent.get(link.students!.id) ?? [],
    }));

    const scheduleRows: ParentDashboardScheduleRow[] = [];
    const uniqueBatchIds = [...batchToStudentIds.keys()];

    if (uniqueBatchIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("class_schedules")
        .select("id, batch_id, day_of_week, start_time, end_time, timezone, batches(name)")
        .in("batch_id", uniqueBatchIds as never)
        .eq("active", true as never);

      if (scheduleError) return parentQueryUnknownError();

      const studentNameById = new Map(students.map((s) => [s.studentId, firstName(s.fullName)]));

      for (const row of (scheduleData ?? []) as unknown as Array<{
        id: string;
        batch_id: string;
        day_of_week: Weekday;
        start_time: string;
        end_time: string;
        timezone: string;
        batches: { name: string } | null;
      }>) {
        const studentIdsForBatch = batchToStudentIds.get(row.batch_id) ?? new Set<string>();
        for (const studentId of studentIdsForBatch) {
          scheduleRows.push({
            id: `${row.id}:${studentId}`,
            studentId,
            studentFirstName: studentNameById.get(studentId) ?? "Student",
            dayOfWeek: row.day_of_week,
            startTime: row.start_time,
            endTime: row.end_time,
            timezone: row.timezone,
            batchName: row.batches?.name ?? "—",
          });
        }
      }

      scheduleRows.sort((a, b) => {
        const dayDiff = WEEKDAY_ORDER.indexOf(a.dayOfWeek) - WEEKDAY_ORDER.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.startTime.localeCompare(b.startTime);
      });
    }

    return parentQueryOk({
      students: students.slice(0, DASHBOARD_STUDENT_PREVIEW_LIMIT),
      studentsTotalCount: students.length,
      schedulePreview: scheduleRows.slice(0, DASHBOARD_SCHEDULE_PREVIEW_LIMIT),
      scheduleTotalCount: scheduleRows.length,
    });
  } catch {
    return parentQueryUnavailable();
  }
}
