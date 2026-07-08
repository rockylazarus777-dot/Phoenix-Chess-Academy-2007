import "server-only";
import { listStudentPrograms, type StudentProgramRow } from "@/lib/queries/student/programs";
import { listStudentBatches, type StudentBatchRow } from "@/lib/queries/student/batches";
import { getStudentSchedule, type StudentScheduleRow } from "@/lib/queries/student/schedule";
import { studentQueryOk, type StudentQueryResult } from "@/lib/portal/queryResult";

const DASHBOARD_PREVIEW_LIMIT = 3;

export interface StudentDashboardData {
  programs: StudentProgramRow[];
  programsTotalCount: number;
  batches: StudentBatchRow[];
  batchesTotalCount: number;
  schedule: StudentScheduleRow[];
  scheduleTotalCount: number;
  /** True only if every underlying query failed to reach the database — a single degraded section still renders the others. */
  anySectionUnavailable: boolean;
}

/**
 * One dashboard query, run as three parallel server queries (not four
 * sequential client `useEffect`s) — see docs/STUDENT_PORTAL_ARCHITECTURE.md,
 * "Student Dashboard Performance". Each underlying query already
 * enforces its own ownership (explicit filter + RLS); this function
 * only trims each result down to a small preview count for the
 * dashboard cards and links out to the full list pages.
 */
export async function getStudentDashboard(studentId: string): Promise<StudentQueryResult<StudentDashboardData>> {
  const [programsResult, batchesResult, scheduleResult] = await Promise.all([
    listStudentPrograms(studentId),
    listStudentBatches(studentId),
    getStudentSchedule(studentId),
  ]);

  const anySectionUnavailable = !programsResult.ok || !batchesResult.ok || !scheduleResult.ok;

  const programs = programsResult.ok ? programsResult.data : [];
  const currentBatches = batchesResult.ok ? batchesResult.data.current : [];
  const schedule = scheduleResult.ok ? scheduleResult.data : [];

  return studentQueryOk({
    programs: programs.slice(0, DASHBOARD_PREVIEW_LIMIT),
    programsTotalCount: programs.length,
    batches: currentBatches.slice(0, DASHBOARD_PREVIEW_LIMIT),
    batchesTotalCount: currentBatches.length,
    schedule: schedule.slice(0, 7),
    scheduleTotalCount: schedule.length,
    anySectionUnavailable,
  });
}
