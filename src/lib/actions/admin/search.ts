"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { searchStudentsForSelect, type StudentOption } from "@/lib/queries/admin/students";
import { searchParentsForSelect, type ParentOption } from "@/lib/queries/admin/parents";
import { listActiveCoachesForSelect, type CoachOption } from "@/lib/queries/admin/coaches";
import { listActiveBatchesForSelect, type BatchOption } from "@/lib/queries/admin/batches";
import { listActivePrograms, listActiveLocations, listTournamentsForSelect } from "@/lib/queries/admin/reference";
import {
  findStudentAccountCandidates,
  findParentAccountCandidates,
  findCoachAccountCandidates,
  type AccountLinkCandidate,
} from "@/lib/queries/admin/accounts";
import { searchStudentsForAdminRecord } from "@/lib/queries/admin/studentRecordSearch";
import { listAdminAchievementsForStudent } from "@/lib/queries/admin/achievements";
import type { AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminStudentSearchResultRow, AdminAchievementListRow } from "@/lib/supabase/types";

/**
 * Thin Server Action wrappers around the read-only query modules, so
 * Client Component form islands (search-as-you-type selects, link
 * dialogs) can call them without ever importing a `server-only` module
 * or the service-role client directly. Each still requires the same
 * VIEW_* permission as the underlying page.
 */

export async function searchStudentsAction(query: string): Promise<AdminQueryResult<StudentOption[]>> {
  await requirePermission("VIEW_STUDENTS");
  return searchStudentsForSelect(query);
}

export async function searchParentsAction(query: string): Promise<AdminQueryResult<ParentOption[]>> {
  await requirePermission("VIEW_PARENTS");
  return searchParentsForSelect(query);
}

export async function listCoachesForSelectAction(): Promise<AdminQueryResult<CoachOption[]>> {
  await requirePermission("VIEW_COACHES");
  return listActiveCoachesForSelect();
}

export async function listBatchesForSelectAction(): Promise<AdminQueryResult<BatchOption[]>> {
  await requirePermission("VIEW_BATCHES");
  return listActiveBatchesForSelect();
}

export async function listProgramsForSelectAction() {
  await requirePermission("VIEW_BATCHES");
  return listActivePrograms();
}

export async function listLocationsForSelectAction() {
  await requirePermission("VIEW_BATCHES");
  return listActiveLocations();
}

export async function findAccountCandidatesAction(
  recordType: "student" | "parent" | "coach",
  query: string,
): Promise<AdminQueryResult<AccountLinkCandidate[]>> {
  await requirePermission("MANAGE_ACCOUNTS");
  if (recordType === "student") return findStudentAccountCandidates(query);
  if (recordType === "parent") return findParentAccountCandidates(query);
  return findCoachAccountCandidates(query);
}

/**
 * Phase 17 — narrow student search for the certificate "new record" form,
 * shared with the achievement form below. Requires MANAGE_CERTIFICATES
 * (not just VIEW_CERTIFICATES) since it exists only to feed a create
 * form. Delegates to `searchStudentsForAdminRecord()`, which calls
 * `search_students_for_admin_record()` through the session client — see
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Student Search
 * Architecture".
 */
export async function searchStudentsForCertificateAction(query: string): Promise<AdminQueryResult<AdminStudentSearchResultRow[]>> {
  await requirePermission("MANAGE_CERTIFICATES");
  return searchStudentsForAdminRecord(query);
}

/** Phase 17 — same narrow student search, gated for the achievement "new record" form. */
export async function searchStudentsForAchievementAction(query: string): Promise<AdminQueryResult<AdminStudentSearchResultRow[]>> {
  await requirePermission("MANAGE_ACHIEVEMENTS");
  return searchStudentsForAdminRecord(query);
}

/**
 * Phase 17 — tournament reference list shared by both the certificate
 * and achievement "new record" forms. Gated on MANAGE_CERTIFICATES: in
 * practice every role holding MANAGE_ACHIEVEMENTS also holds
 * MANAGE_CERTIFICATES (both are bundled together in ADMIN_PERMISSIONS/
 * SUPER_ADMIN_PERMISSIONS — see src/lib/auth/permissions.ts), so this
 * single gate covers both callers without needing an "either/or"
 * permission check.
 */
export async function listTournamentsForSelectAction() {
  await requirePermission("MANAGE_CERTIFICATES");
  return listTournamentsForSelect();
}

/**
 * Phase 17 — the certificate form's optional "linked achievement" select.
 * Filters achievements down to the selected student server-side; the
 * client never receives another student's achievement id as an option, so
 * the certificate form cannot even present a cross-student choice (the
 * RPC still independently re-validates ownership as defense in depth).
 */
export async function listAchievementsForStudentAction(studentId: string): Promise<AdminQueryResult<AdminAchievementListRow[]>> {
  await requirePermission("MANAGE_CERTIFICATES");
  return listAdminAchievementsForStudent(studentId);
}
