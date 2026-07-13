/**
 * Narrow, hand-written Supabase database types.
 *
 * This project does NOT have a live Supabase project connected in this
 * environment, so `supabase gen types typescript --project-id <id>`
 * (the correct, future command — see docs/DATABASE_ARCHITECTURE.md,
 * "Database Types") cannot be run here. Rather than hand-maintain a
 * giant fake `Tables` type that mirrors every migration and inevitably
 * drifts from the real SQL, this file only types the exact surface the
 * application code currently calls.
 *
 * Once a real Supabase project exists, replace this file with the
 * generated output and remove this hand-written version — treat any
 * mismatch after codegen as a signal that a migration and this file
 * drifted and reconcile them.
 *
 * PHASE 10 ADDITION: the admin operations tables
 * (students/parents/student_parents/coaches/batches/batch_coaches/
 * class_schedules/student_program_enrollments/batch_enrollments/
 * admin_audit_log) and a narrow slice of `programs`/`academy_locations`
 * (id/slug/name only, for populating admin select inputs) are typed
 * here because the Phase 10 admin query/action modules
 * (src/lib/queries/admin/*.ts, src/lib/actions/admin/*.ts) genuinely
 * query them by name via the service-role client
 * (src/lib/supabase/admin.ts). Every one of these tables mirrors
 * supabase/migrations/0012_admin_operations_schema.sql exactly.
 */
type OutboxEventStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface ReportingOutboxRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  processed_at: string | null;
}

export type UserRole = "STUDENT" | "PARENT" | "COACH" | "STAFF" | "ADMIN" | "SUPER_ADMIN";

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
  // Set exactly once, by activate_own_profile() (0029_profile_activation.sql),
  // the moment an invited user creates their first password. Never
  // touched by deactivateAccount()/reactivateAccount() — see
  // docs/AUTH_ARCHITECTURE.md, "Accept Invite Architecture".
  invite_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// PHASE 10 — admin operations row shapes
// ---------------------------------------------------------------------------

export type StudentStatus = "ACTIVE" | "INACTIVE" | "ON_HOLD" | "ALUMNI" | "ARCHIVED";
export type ParentStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type CoachStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type ParentRelationship = "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER";
export type TrainingMode = "ONLINE" | "OFFLINE" | "HYBRID";
export type BatchStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type BatchCoachRole = "PRIMARY" | "ASSISTANT" | "GUEST";
export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type EnrollmentStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "WITHDRAWN" | "CANCELLED";
export type BatchEnrollmentStatus = "ACTIVE" | "ENDED" | "TRANSFERRED";
export type AdminAuditAction =
  | "STUDENT_CREATED"
  | "STUDENT_UPDATED"
  | "STUDENT_STATUS_CHANGED"
  | "PARENT_CREATED"
  | "PARENT_UPDATED"
  | "PARENT_LINKED"
  | "PARENT_UNLINKED"
  | "COACH_CREATED"
  | "COACH_UPDATED"
  | "BATCH_CREATED"
  | "BATCH_UPDATED"
  | "BATCH_COACH_ASSIGNED"
  | "BATCH_COACH_UNASSIGNED"
  | "SCHEDULE_CREATED"
  | "SCHEDULE_UPDATED"
  | "ENROLLMENT_CREATED"
  | "ENROLLMENT_UPDATED"
  | "BATCH_ENROLLMENT_CREATED"
  | "BATCH_ENROLLMENT_ENDED"
  | "ACCOUNT_INVITED"
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DEACTIVATED"
  | "ACCOUNT_REACTIVATED"
  | "ROLE_CHANGED"
  | "BULK_IMPORT_COMPLETED";

export interface StudentRow {
  id: string;
  profile_id: string | null;
  student_code: string;
  full_name: string;
  date_of_birth: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string;
  state: string | null;
  city: string | null;
  address: string | null;
  fide_id: string | null;
  fide_rating: number | null;
  chess_association_id: string | null;
  current_level: string | null;
  joined_on: string | null;
  status: StudentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  status: ParentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentParentRow {
  student_id: string;
  parent_id: string;
  relationship: ParentRelationship;
  is_primary: boolean;
  can_receive_updates: boolean;
  can_manage_student: boolean;
  created_at: string;
}

export interface CoachRow {
  id: string;
  profile_id: string | null;
  coach_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  specializations: string[];
  status: CoachStatus;
  joined_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchRow {
  id: string;
  batch_code: string;
  name: string;
  program_id: string;
  location_id: string | null;
  training_mode: TrainingMode;
  level: string | null;
  primary_coach_id: string | null;
  capacity: number | null;
  status: BatchStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchCoachRow {
  id: string;
  batch_id: string;
  coach_id: string;
  role: BatchCoachRole;
  assigned_at: string;
  ended_at: string | null;
}

export interface ClassScheduleRow {
  id: string;
  batch_id: string;
  day_of_week: Weekday;
  start_time: string;
  end_time: string;
  timezone: string;
  effective_from: string | null;
  effective_until: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentProgramEnrollmentRow {
  id: string;
  student_id: string;
  program_id: string;
  batch_id: string | null;
  status: EnrollmentStatus;
  enrolled_on: string;
  completed_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchEnrollmentRow {
  id: string;
  student_id: string;
  batch_id: string;
  status: BatchEnrollmentStatus;
  assigned_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AdminAuditLogRow {
  id: string;
  actor_profile_id: string | null;
  actor_role: UserRole;
  action: AdminAuditAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// PHASE 11 — student portal row shapes
// ---------------------------------------------------------------------------

/** Return shape of the `get_student_batch_coaches()` RPC — see supabase/migrations/0016_student_portal_rls.sql. Deliberately narrow: no email/phone/whatsapp/bio. */
export interface StudentBatchCoachRow {
  batch_id: string;
  coach_id: string;
  full_name: string;
  role: BatchCoachRole;
}

// ---------------------------------------------------------------------------
// PHASE 12 — parent portal row shapes
// ---------------------------------------------------------------------------

/** Return shape of the `get_parent_linked_student_batch_coaches(uuid)` RPC — see supabase/migrations/0017_parent_portal_rls.sql. Deliberately narrow: no email/phone/whatsapp/bio. Structurally identical to `StudentBatchCoachRow` but kept as its own named type since the student and parent portals are decoupled. */
export interface ParentBatchCoachRow {
  batch_id: string;
  coach_id: string;
  full_name: string;
  role: BatchCoachRole;
}

// ---------------------------------------------------------------------------
// PHASE 13 — coach portal row shapes
// ---------------------------------------------------------------------------

/** Return shape of the `get_coach_batch_roster(uuid)` RPC — see supabase/migrations/0018_coach_portal_rls.sql. Deliberately narrow: no date_of_birth/address/email/phone/whatsapp/notes/chess_association_id/parent data. `assignment_status` is null when the student is connected only via student_program_enrollments.batch_id (no mirrored batch_enrollments row) — never fabricated as ACTIVE. */
export interface CoachRosterStudentRow {
  student_id: string;
  student_code: string;
  full_name: string;
  current_level: string | null;
  status: StudentStatus;
  fide_id: string | null;
  fide_rating: number | null;
  assignment_status: BatchEnrollmentStatus | null;
}

// ---------------------------------------------------------------------------
// PHASE 14 — class sessions + attendance row shapes
// ---------------------------------------------------------------------------

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/** Mirrors supabase/migrations/0019_class_sessions_attendance.sql exactly. A dated occurrence — never confused with ClassScheduleRow (a recurring definition). */
export interface ClassSessionRow {
  id: string;
  batch_id: string;
  schedule_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: SessionStatus;
  training_mode: TrainingMode | null;
  location_id: string | null;
  topic: string | null;
  coach_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

/** Mirrors supabase/migrations/0019_class_sessions_attendance.sql exactly. One row per (session_id, student_id) — a missing row means Not Marked, never a fabricated status. */
export interface AttendanceRecordRow {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_by: string;
  marked_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Return shape of the `get_coach_session_attendance(uuid)` RPC — see supabase/migrations/0020_attendance_rls.sql. Deliberately narrow: no DOB/address/email/phone/whatsapp/parent data. `attendance_status`/`notes`/`marked_at` are null when the student has not been marked yet for this session — never fabricated as PRESENT/ABSENT. */
export interface CoachSessionAttendanceRow {
  student_id: string;
  student_code: string;
  full_name: string;
  current_level: string | null;
  attendance_status: AttendanceStatus | null;
  notes: string | null;
  marked_at: string | null;
}

/** Return shape of the `get_student_attendance()` RPC — see supabase/migrations/0020_attendance_rls.sql. Never includes attendance_records.notes (coach-only operational data). `attendance_status` is null when the session has not been marked yet — Not Marked, never fabricated. */
export interface StudentAttendanceRow {
  session_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  batch_id: string;
  batch_name: string;
  session_status: SessionStatus;
  attendance_status: AttendanceStatus | null;
}

/** Return shape of the `get_parent_student_attendance(uuid)` RPC — see supabase/migrations/0020_attendance_rls.sql. Structurally identical to `StudentAttendanceRow` but kept as its own named type per the student/parent decoupling convention. Never includes attendance_records.notes. */
export interface ParentAttendanceRow {
  session_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  batch_id: string;
  batch_name: string;
  session_status: SessionStatus;
  attendance_status: AttendanceStatus | null;
}

// ---------------------------------------------------------------------------
// PHASE 15 — student progress evaluation row shapes
// ---------------------------------------------------------------------------

export type ProgressEvaluationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type DevelopmentArea =
  | "OPENING"
  | "MIDDLEGAME"
  | "ENDGAME"
  | "TACTICS"
  | "CALCULATION"
  | "POSITIONAL_PLAY"
  | "TIME_MANAGEMENT"
  | "CONCENTRATION"
  | "DECISION_MAKING"
  | "TOURNAMENT_PREPARATION";

/** Mirrors supabase/migrations/0021_student_progress_evaluations.sql exactly. coach_id/created_by are always server/RPC-derived — never accepted from browser input. */
export interface StudentProgressEvaluationRow {
  id: string;
  student_id: string;
  batch_id: string;
  program_id: string | null;
  coach_id: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: ProgressEvaluationStatus;
  overall_summary: string | null;
  strengths: string | null;
  development_focus: string | null;
  coach_recommendation: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

/** Mirrors supabase/migrations/0021_student_progress_evaluations.sql exactly. rating is a 1-5 internal development scale — never a percentage/Elo-like/FIDE-style score. */
export interface StudentProgressAreaRatingRow {
  id: string;
  evaluation_id: string;
  area: DevelopmentArea;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape of one element inside the aggregated `area_ratings` jsonb array returned by every Phase 15 read RPC below. */
export interface ProgressAreaRatingJson {
  area: DevelopmentArea;
  rating: number;
  comment: string | null;
}

/** Return shape of the `get_coach_progress_evaluations()` RPC — see supabase/migrations/0022_student_progress_rls.sql. No fabricated overall/percentage score anywhere. */
export interface CoachProgressListRow {
  evaluation_id: string;
  student_id: string;
  student_code: string;
  student_full_name: string;
  batch_id: string;
  batch_name: string;
  program_name: string | null;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: ProgressEvaluationStatus;
  updated_at: string;
}

/** Return shape of the `get_coach_progress_evaluation(uuid)` RPC. `coach_can_manage` gates Edit/Publish/Archive UI without exposing coach_id/created_by/published_by UUIDs. */
export interface CoachProgressDetailRow {
  evaluation_id: string;
  student_id: string;
  student_code: string;
  student_full_name: string;
  student_current_level: string | null;
  batch_id: string;
  batch_name: string;
  program_id: string | null;
  program_name: string | null;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: ProgressEvaluationStatus;
  overall_summary: string | null;
  strengths: string | null;
  development_focus: string | null;
  coach_recommendation: string | null;
  author_name: string;
  created_at: string;
  published_at: string | null;
  coach_can_manage: boolean;
  area_ratings: ProgressAreaRatingJson[] | null;
}

/** Return shape of the `get_coach_batch_progress(uuid)` RPC. author_name is a display name only — never coach contact details. */
export interface CoachBatchProgressRow {
  evaluation_id: string;
  student_id: string;
  student_code: string;
  student_full_name: string;
  program_name: string | null;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: ProgressEvaluationStatus;
  author_name: string;
  updated_at: string;
}

/** Return shape of the `get_coach_student_progress(uuid, uuid)` RPC. */
export interface CoachStudentProgressRow {
  evaluation_id: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: ProgressEvaluationStatus;
  overall_summary: string | null;
  strengths: string | null;
  development_focus: string | null;
  coach_recommendation: string | null;
  author_name: string;
  published_at: string | null;
  area_ratings: ProgressAreaRatingJson[] | null;
}

/** Return shape of the `get_student_progress_evaluations()` RPC — PUBLISHED only, never created_by/published_by/coach contact details. */
export interface StudentProgressRow {
  evaluation_id: string;
  batch_id: string;
  batch_name: string;
  program_name: string | null;
  evaluation_period_start: string;
  evaluation_period_end: string;
  overall_summary: string | null;
  strengths: string | null;
  development_focus: string | null;
  coach_recommendation: string | null;
  coach_display_name: string;
  published_at: string;
  area_ratings: ProgressAreaRatingJson[] | null;
}

/** Return shape of the `get_parent_student_progress_evaluations(uuid)` RPC. Structurally identical to `StudentProgressRow` but kept as its own named type per the student/parent decoupling convention. */
export interface ParentProgressRow {
  evaluation_id: string;
  batch_id: string;
  batch_name: string;
  program_name: string | null;
  evaluation_period_start: string;
  evaluation_period_end: string;
  overall_summary: string | null;
  strengths: string | null;
  development_focus: string | null;
  coach_recommendation: string | null;
  coach_display_name: string;
  published_at: string;
  area_ratings: ProgressAreaRatingJson[] | null;
}

// ---------------------------------------------------------------------------
// PHASE 16 — assignments + submissions row shapes
// ---------------------------------------------------------------------------

export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AssignmentAudienceType = "BATCH" | "STUDENT";
export type AssignmentSubmissionStatus = "SUBMITTED" | "REVIEWED" | "REVISION_REQUESTED";

/** Mirrors supabase/migrations/0023_assignments_submissions.sql exactly. coach_id/created_by are always server/RPC-derived — never accepted from browser input. program_id is always the assigned batch's own program_id. */
export interface AssignmentRow {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  audience_type: AssignmentAudienceType;
  batch_id: string;
  student_id: string | null;
  program_id: string | null;
  session_id: string | null;
  coach_id: string;
  status: AssignmentStatus;
  due_at: string | null;
  allow_late_submission: boolean;
  created_by: string;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors supabase/migrations/0023_assignments_submissions.sql exactly. The stable, published-time audience snapshot — never recalculated from live batch membership. */
export interface AssignmentRecipientRow {
  id: string;
  assignment_id: string;
  student_id: string;
  assigned_at: string;
  created_at: string;
}

/** Mirrors supabase/migrations/0023_assignments_submissions.sql exactly. One CURRENT row per (assignment_id, student_id) — resubmission updates this same row. No numeric grade/score/percentage column exists. */
export interface AssignmentSubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  status: AssignmentSubmissionStatus;
  submission_text: string | null;
  submission_url: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  coach_feedback: string | null;
  created_at: string;
  updated_at: string;
}

/** Return shape of the `get_coach_assignments()` RPC — see supabase/migrations/0024_assignments_rls.sql. Explicit recipient_count/submission_count — never a fabricated completion percentage. */
export interface CoachAssignmentListRow {
  assignment_id: string;
  title: string;
  audience_type: AssignmentAudienceType;
  batch_id: string;
  batch_name: string;
  student_id: string | null;
  student_full_name: string | null;
  student_code: string | null;
  program_name: string | null;
  due_at: string | null;
  status: AssignmentStatus;
  published_at: string | null;
  updated_at: string;
  recipient_count: number;
  submission_count: number;
}

/** Return shape of the `get_coach_assignment(uuid)` RPC. coach_can_manage/coach_can_archive gate Edit/Publish/Archive UI without exposing coach_id/created_by/published_by UUIDs. */
export interface CoachAssignmentDetailRow {
  assignment_id: string;
  title: string;
  description: string;
  instructions: string | null;
  audience_type: AssignmentAudienceType;
  batch_id: string;
  batch_name: string;
  student_id: string | null;
  student_full_name: string | null;
  student_code: string | null;
  program_name: string | null;
  session_id: string | null;
  session_date: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  status: AssignmentStatus;
  author_name: string;
  published_at: string | null;
  created_at: string;
  recipient_count: number;
  submission_count: number;
  coach_can_manage: boolean;
  coach_can_archive: boolean;
}

/** Return shape of the `get_coach_batch_assignments(uuid)` RPC. author_name is a display name only — never coach contact details. */
export interface CoachBatchAssignmentRow {
  assignment_id: string;
  title: string;
  audience_type: AssignmentAudienceType;
  student_full_name: string | null;
  student_code: string | null;
  program_name: string | null;
  due_at: string | null;
  status: AssignmentStatus;
  author_name: string;
  updated_at: string;
  recipient_count: number;
  submission_count: number;
}

/** Return shape of the `get_coach_assignment_submissions(uuid)` RPC. null submission_id/status means Not Submitted — a UI-only label, never persisted. */
export interface CoachAssignmentSubmissionRow {
  student_id: string;
  student_code: string;
  student_full_name: string;
  submission_id: string | null;
  status: AssignmentSubmissionStatus | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

/** Return shape of the `get_coach_assignment_submission(uuid, uuid)` RPC. coach_can_review mirrors review_assignment_submission()'s author-only + current-batch authorization. */
export interface CoachAssignmentSubmissionDetailRow {
  submission_id: string;
  student_id: string;
  student_code: string;
  student_full_name: string;
  assignment_title: string;
  submission_text: string | null;
  submission_url: string | null;
  submitted_at: string;
  status: AssignmentSubmissionStatus;
  coach_feedback: string | null;
  reviewed_at: string | null;
  coach_can_review: boolean;
}

/** Return shape of the `get_student_assignments()` RPC — read authorization derives from assignment_recipients, never live batch membership. DRAFT never appears. null submission_status means Not Submitted. */
export interface StudentAssignmentRow {
  assignment_id: string;
  title: string;
  batch_name: string;
  program_name: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  status: AssignmentStatus;
  submission_status: AssignmentSubmissionStatus | null;
}

/** Return shape of the `get_student_assignment(uuid)` RPC — the current student's own submission only; never other recipients/submissions/coach contact details. */
export interface StudentAssignmentDetailRow {
  assignment_id: string;
  title: string;
  description: string;
  instructions: string | null;
  batch_name: string;
  program_name: string | null;
  session_date: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  status: AssignmentStatus;
  submission_id: string | null;
  submission_status: AssignmentSubmissionStatus | null;
  submission_text: string | null;
  submission_url: string | null;
  coach_feedback: string | null;
  submitted_at: string | null;
}

/** Return shape of the `get_parent_student_assignments(uuid)` RPC. Structurally identical to `StudentAssignmentRow` but kept as its own named type per the student/parent decoupling convention. */
export interface ParentAssignmentRow {
  assignment_id: string;
  title: string;
  batch_name: string;
  program_name: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  status: AssignmentStatus;
  submission_status: AssignmentSubmissionStatus | null;
}

/** Return shape of the `get_parent_student_assignment(uuid, uuid)` RPC. Structurally identical to `StudentAssignmentDetailRow` but kept as its own named type per the student/parent decoupling convention. Read-only — no parent submit/edit/review RPC exists. */
export interface ParentAssignmentDetailRow {
  assignment_id: string;
  title: string;
  description: string;
  instructions: string | null;
  batch_name: string;
  program_name: string | null;
  session_date: string | null;
  due_at: string | null;
  allow_late_submission: boolean;
  status: AssignmentStatus;
  submission_id: string | null;
  submission_status: AssignmentSubmissionStatus | null;
  submission_text: string | null;
  submission_url: string | null;
  coach_feedback: string | null;
  submitted_at: string | null;
}

/** Narrow slice only — id/slug/name/active, used to populate admin selects. */
export interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  active: boolean;
}

/** Narrow slice only — id/name/slug/active, used to populate admin selects. */
export interface AcademyLocationRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

/** Narrow slice only — id/name/status, used to populate the Phase 17 certificate/achievement "new record" forms' optional tournament select. */
export interface TournamentOption {
  id: string;
  name: string;
  status: string;
}

// ---------------------------------------------------------------------------
// PHASE 17 — certificates + achievement records
// ---------------------------------------------------------------------------

export type CertificateStatus = "DRAFT" | "ISSUED" | "REVOKED";
export type CertificateType = "PROGRAM_COMPLETION" | "PARTICIPATION" | "TOURNAMENT_PARTICIPATION" | "TOURNAMENT_ACHIEVEMENT" | "SPECIAL_RECOGNITION";
export type AchievementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AchievementType =
  | "TOURNAMENT_WINNER"
  | "TOURNAMENT_RUNNER_UP"
  | "TOURNAMENT_PLACEMENT"
  | "CHESS_MILESTONE"
  | "ACADEMY_RECOGNITION"
  | "EXTERNAL_CHESS_ACHIEVEMENT";

/** Mirrors `public.student_certificates` (0025) exactly. */
export interface StudentCertificateRow {
  id: string;
  student_id: string;
  certificate_type: CertificateType;
  title: string;
  description: string | null;
  program_id: string | null;
  tournament_id: string | null;
  achievement_id: string | null;
  certificate_number: string | null;
  status: CertificateStatus;
  issued_on: string | null;
  issued_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors `public.student_achievements` (0025) exactly. */
export interface StudentAchievementRow {
  id: string;
  student_id: string;
  achievement_type: AchievementType;
  title: string;
  description: string | null;
  achievement_date: string | null;
  program_id: string | null;
  tournament_id: string | null;
  placement: number | null;
  external_organization: string | null;
  status: AchievementStatus;
  published_at: string | null;
  published_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Return shape of `search_students_for_admin_record(text)`. Never includes contact PII. */
export interface AdminStudentSearchResultRow {
  student_id: string;
  student_name: string;
  student_code: string;
}

/** Return shape of `get_admin_certificates()`. */
export interface AdminCertificateListRow {
  certificate_id: string;
  certificate_number: string | null;
  student_id: string;
  student_name: string;
  student_code: string;
  certificate_type: CertificateType;
  title: string;
  program_name: string | null;
  tournament_name: string | null;
  status: CertificateStatus;
  issued_on: string | null;
  created_at: string;
}

/** Return shape of `get_admin_certificate(uuid)`. Never includes created_by/issued_by/revoked_by UUIDs. */
export interface AdminCertificateDetailRow {
  certificate_id: string;
  certificate_number: string | null;
  student_id: string;
  student_name: string;
  student_code: string;
  certificate_type: CertificateType;
  title: string;
  description: string | null;
  program_id: string | null;
  program_name: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  achievement_id: string | null;
  achievement_title: string | null;
  status: CertificateStatus;
  issued_on: string | null;
  created_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
}

/** Return shape of `get_admin_achievements()`. */
export interface AdminAchievementListRow {
  achievement_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  achievement_type: AchievementType;
  title: string;
  achievement_date: string | null;
  tournament_name: string | null;
  placement: number | null;
  status: AchievementStatus;
  created_at: string;
}

/** Return shape of `get_admin_achievement(uuid)`. Never includes created_by/published_by UUIDs. */
export interface AdminAchievementDetailRow {
  achievement_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  achievement_type: AchievementType;
  title: string;
  description: string | null;
  achievement_date: string | null;
  program_id: string | null;
  program_name: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  placement: number | null;
  external_organization: string | null;
  status: AchievementStatus;
  published_at: string | null;
  created_at: string;
}

/** Return shape of `get_student_certificates()`. DRAFT never appears. */
export interface StudentCertificateListRow {
  certificate_id: string;
  certificate_number: string | null;
  certificate_type: CertificateType;
  title: string;
  program_name: string | null;
  tournament_name: string | null;
  issued_on: string | null;
  status: CertificateStatus;
}

/** Return shape of `get_student_certificate(uuid)`/`get_parent_student_certificate(uuid,uuid)`. Never includes revoked_by. */
export interface StudentCertificateDetailRow {
  certificate_id: string;
  certificate_number: string | null;
  certificate_type: CertificateType;
  title: string;
  description: string | null;
  program_name: string | null;
  tournament_name: string | null;
  achievement_id: string | null;
  achievement_title: string | null;
  issued_on: string | null;
  status: CertificateStatus;
  revocation_reason: string | null;
}

/** Return shape of `get_student_achievements()`. DRAFT never appears. */
export interface StudentAchievementListRow {
  achievement_id: string;
  achievement_type: AchievementType;
  title: string;
  achievement_date: string | null;
  program_name: string | null;
  tournament_name: string | null;
  placement: number | null;
  external_organization: string | null;
  status: AchievementStatus;
}

/** Return shape of `get_student_achievement(uuid)`/`get_parent_student_achievement(uuid,uuid)`. */
export interface StudentAchievementDetailRow {
  achievement_id: string;
  achievement_type: AchievementType;
  title: string;
  description: string | null;
  achievement_date: string | null;
  program_name: string | null;
  tournament_name: string | null;
  placement: number | null;
  external_organization: string | null;
  status: AchievementStatus;
}

/** Return shape of `get_parent_student_certificates(uuid)`. Structurally identical to `StudentCertificateListRow`, kept as its own named type per the student/parent decoupling convention. */
export type ParentCertificateListRow = StudentCertificateListRow;

/** Return shape of `get_parent_student_achievements(uuid)`. Structurally identical to `StudentAchievementListRow`, kept as its own named type per the student/parent decoupling convention. */
export type ParentAchievementListRow = StudentAchievementListRow;

// ---------------------------------------------------------------------------
// PHASE 18 — certificate PDF generation + private R2 storage + secure download
// ---------------------------------------------------------------------------

export type CertificateDocumentStatus = "GENERATING" | "AVAILABLE" | "FAILED" | "SUPERSEDED";

/** Mirrors `public.certificate_documents` (0027) exactly. Never includes a public/signed/presigned URL — see docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md. */
export interface CertificateDocumentRow {
  id: string;
  certificate_id: string;
  version: number;
  status: CertificateDocumentStatus;
  storage_provider: string;
  storage_bucket: string;
  storage_key: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sha256_checksum: string | null;
  generated_at: string | null;
  generated_by: string | null;
  generation_error_code: string | null;
  created_at: string;
  updated_at: string;
}

/** Return shape of `begin_certificate_document_generation(uuid)`. */
export interface BeginCertificateGenerationRow {
  document_id: string;
  certificate_id: string;
  version: number;
  certificate_number: string;
}

/** Return shape of `get_certificate_generation_context(uuid)`. Never includes student contact PII, parent data, payment data, or internal profile UUIDs — this is the narrow input boundary for the PDF generator. */
export interface CertificateGenerationContextRow {
  certificate_id: string;
  certificate_number: string;
  certificate_type: CertificateType;
  title: string;
  description: string | null;
  issued_on: string;
  student_name: string;
  program_name: string | null;
  tournament_name: string | null;
  achievement_title: string | null;
  status: CertificateStatus;
}

/** Return shape of `get_admin_certificate_documents(uuid)`. Never includes storage_key/storage_bucket/sha256_checksum/generated_by. */
export interface AdminCertificateDocumentRow {
  document_id: string;
  version: number;
  status: CertificateDocumentStatus;
  generated_at: string | null;
  file_size_bytes: number | null;
  generation_error_code: string | null;
}

/** Return shape of `resolve_certificate_download(uuid)` — server-only, used exclusively by the download Route Handler. Never serialized into browser HTML. */
export interface CertificateDownloadResolutionRow {
  certificate_id: string;
  certificate_number: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  document_id: string;
}

export interface Database {
  public: {
    Tables: {
      reporting_outbox: {
        Row: ReportingOutboxRow;
        Insert: Partial<ReportingOutboxRow> & Pick<ReportingOutboxRow, "event_type" | "aggregate_type" | "aggregate_id" | "payload">;
        Update: Partial<ReportingOutboxRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        // No public Insert/Update surface — profile creation/role changes
        // happen through a future server-authorized path, never a direct
        // client insert/update (see docs/AUTH_ARCHITECTURE.md, "Profile
        // RLS Review"). Typed as `never` so an accidental
        // `.from("profiles").insert(...)`/`.update(...)` call anywhere in
        // the app fails to compile rather than silently relying on RLS
        // alone to block it.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      students: {
        Row: StudentRow;
        // student_code is server/database-generated (default expression
        // in the migration) and never accepted from the client — see
        // docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Student Code
        // Generation". Direct .insert() is still typed (used by simple
        // single-table admin mutations); the audited creation path goes
        // through create_student_with_audit() instead.
        Insert: Omit<StudentRow, "id" | "student_code" | "created_at" | "updated_at" | "status"> & {
          status?: StudentStatus;
        };
        Update: Partial<Omit<StudentRow, "id" | "student_code" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      parents: {
        Row: ParentRow;
        Insert: Omit<ParentRow, "id" | "created_at" | "updated_at" | "status"> & { status?: ParentStatus };
        Update: Partial<Omit<ParentRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      student_parents: {
        Row: StudentParentRow;
        Insert: Omit<StudentParentRow, "created_at">;
        Update: Partial<Omit<StudentParentRow, "student_id" | "parent_id" | "created_at">>;
        Relationships: [];
      };
      coaches: {
        Row: CoachRow;
        Insert: Omit<CoachRow, "id" | "coach_code" | "created_at" | "updated_at" | "status" | "specializations"> & {
          status?: CoachStatus;
          specializations?: string[];
        };
        Update: Partial<Omit<CoachRow, "id" | "coach_code" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      batches: {
        Row: BatchRow;
        Insert: Omit<BatchRow, "id" | "created_at" | "updated_at" | "status"> & { status?: BatchStatus };
        Update: Partial<Omit<BatchRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      batch_coaches: {
        Row: BatchCoachRow;
        Insert: Omit<BatchCoachRow, "id" | "assigned_at"> & { assigned_at?: string };
        Update: Partial<Pick<BatchCoachRow, "ended_at" | "role">>;
        Relationships: [];
      };
      class_schedules: {
        Row: ClassScheduleRow;
        Insert: Omit<ClassScheduleRow, "id" | "created_at" | "updated_at" | "active" | "timezone"> & {
          active?: boolean;
          timezone?: string;
        };
        Update: Partial<Omit<ClassScheduleRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      student_program_enrollments: {
        Row: StudentProgramEnrollmentRow;
        Insert: Omit<StudentProgramEnrollmentRow, "id" | "created_at" | "updated_at" | "status" | "enrolled_on"> & {
          status?: EnrollmentStatus;
          enrolled_on?: string;
        };
        Update: Partial<Omit<StudentProgramEnrollmentRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      batch_enrollments: {
        Row: BatchEnrollmentRow;
        Insert: Omit<BatchEnrollmentRow, "id" | "created_at" | "assigned_at" | "status"> & {
          assigned_at?: string;
          status?: BatchEnrollmentStatus;
        };
        Update: Partial<Pick<BatchEnrollmentRow, "status" | "ended_at">>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: AdminAuditLogRow;
        // Never inserted directly from application code — every audit
        // entry is written by record_admin_audit() or one of the
        // *_with_audit() RPCs (SECURITY DEFINER, service_role-only). See
        // docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Audit Log Architecture".
        Insert: never;
        Update: never;
        Relationships: [];
      };
      programs: {
        Row: ProgramRow;
        // Phase 10 only reads the narrow slice above (admin selects) —
        // no admin write path exists for programs in this phase.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      academy_locations: {
        Row: AcademyLocationRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      class_sessions: {
        Row: ClassSessionRow;
        // Coaches insert directly (RLS: class_sessions_insert_for_assigned_coach
        // requires coach_has_batch(batch_id) AND created_by = auth.uid()).
        // status/cancelled_at/cancelled_by are never part of an ordinary
        // insert — a new session is always SCHEDULED — and are never
        // updated directly from application code: every status change
        // goes through transition_class_session_status() instead (see
        // docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md). Update is
        // typed `never` because no direct .update() call exists anywhere
        // in Phase 14 application code.
        Insert: Omit<
          ClassSessionRow,
          "id" | "status" | "created_at" | "updated_at" | "cancelled_at" | "cancelled_by" | "timezone"
        > & { timezone?: string };
        Update: never;
        Relationships: [];
      };
      attendance_records: {
        Row: AttendanceRecordRow;
        // No direct insert/update from application code anywhere in
        // Phase 14 — every write goes through mark_session_attendance().
        // Typed `never` so an accidental direct call fails to compile.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_progress_evaluations: {
        Row: StudentProgressEvaluationRow;
        // No direct insert/update from application code anywhere in
        // Phase 15 — every write goes through create_/update_/publish_/
        // archive_student_progress_evaluation(). Typed `never` so an
        // accidental direct call fails to compile. See
        // docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Evaluation Write
        // Architecture".
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_progress_area_ratings: {
        Row: StudentProgressAreaRatingRow;
        // No direct insert/update from application code — ratings are
        // only ever written inside create_/update_student_progress_evaluation().
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignments: {
        Row: AssignmentRow;
        // No direct insert/update from application code anywhere in
        // Phase 16 — every write goes through create_/update_/publish_/
        // archive_assignment(). Typed `never` so an accidental direct
        // call fails to compile. See docs/ASSIGNMENTS_ARCHITECTURE.md,
        // "Assignment Write Architecture".
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_recipients: {
        Row: AssignmentRecipientRow;
        // No direct insert/update from application code — the
        // recipient snapshot is only ever written inside
        // publish_assignment(). Typed `never` so an accidental direct
        // call fails to compile.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_submissions: {
        Row: AssignmentSubmissionRow;
        // No direct insert/update from application code — every write
        // goes through submit_assignment() (student) or
        // review_assignment_submission() (coach).
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_certificates: {
        Row: StudentCertificateRow;
        // No direct insert/update from application code anywhere in
        // Phase 17 — every write goes through create_/update_/issue_/
        // revoke_student_certificate(). Typed `never` so an accidental
        // direct call fails to compile. See
        // docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate
        // Write Architecture".
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_achievements: {
        Row: StudentAchievementRow;
        // No direct insert/update from application code — every write
        // goes through create_/update_/publish_/archive_student_achievement().
        Insert: never;
        Update: never;
        Relationships: [];
      };
      certificate_documents: {
        Row: CertificateDocumentRow;
        // No direct insert/update from application code anywhere in
        // Phase 18 — every write goes through begin_/finalize_/
        // fail_certificate_document_generation(). Typed `never` so an
        // accidental direct call fails to compile. See
        // docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Generation
        // Lifecycle".
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_contact_enquiry: {
        Args: {
          p_full_name: string;
          p_email: string;
          p_phone: string | null;
          p_country: string;
          p_enquiry_type: string;
          p_subject: string;
          p_message: string;
          p_source: string;
        };
        Returns: string;
      };
      submit_trial_booking: {
        Args: {
          p_student_full_name: string;
          p_date_of_birth: string;
          p_chess_level: string;
          p_fide_id: string | null;
          p_fide_rating: number | null;
          p_country: string;
          p_state: string;
          p_city: string;
          p_preferred_program: string;
          p_training_mode: string;
          p_preferred_schedule: string | null;
          p_goals: string | null;
          p_parent_name: string | null;
          p_parent_email: string | null;
          p_parent_phone: string | null;
          p_parent_relationship: string | null;
          p_privacy_acknowledged: boolean;
          p_marketing_consent: boolean;
          p_source: string;
        };
        Returns: string;
      };
      submit_tournament_registration: {
        Args: {
          p_tournament_slug: string;
          p_category_key: string;
          p_player_full_name: string;
          p_date_of_birth: string;
          p_gender: string | null;
          p_fide_id: string | null;
          p_fide_rating: number | null;
          p_chess_association_id: string | null;
          p_country: string;
          p_state: string;
          p_city: string;
          p_email: string;
          p_phone: string;
          p_whatsapp: string | null;
          p_parent_name: string | null;
          p_parent_relationship: string | null;
          p_parent_email: string | null;
          p_parent_phone: string | null;
          p_current_chess_level: string | null;
          p_school_or_academy: string | null;
          p_club: string | null;
          p_rules_acknowledged: boolean;
          p_privacy_acknowledged: boolean;
          p_media_consent: boolean;
          p_marketing_consent: boolean;
          p_source: string;
        };
        Returns: string;
      };
      record_admin_audit: {
        Args: {
          p_actor_profile_id: string | null;
          p_actor_role: UserRole;
          p_action: AdminAuditAction;
          p_entity_type: string;
          p_entity_id: string | null;
          p_summary: string;
          p_metadata: Record<string, unknown>;
        };
        Returns: string;
      };
      create_student_with_audit: {
        Args: {
          p_full_name: string;
          p_date_of_birth: string;
          p_gender: string | null;
          p_email: string | null;
          p_phone: string | null;
          p_whatsapp: string | null;
          p_country: string;
          p_state: string | null;
          p_city: string | null;
          p_address: string | null;
          p_fide_id: string | null;
          p_fide_rating: number | null;
          p_chess_association_id: string | null;
          p_current_level: string | null;
          p_joined_on: string | null;
          p_notes: string | null;
          p_actor_profile_id: string;
          p_actor_role: UserRole;
        };
        Returns: string;
      };
      link_parent_to_student_with_audit: {
        Args: {
          p_student_id: string;
          p_parent_id: string;
          p_relationship: ParentRelationship;
          p_is_primary: boolean;
          p_can_receive_updates: boolean;
          p_can_manage_student: boolean;
          p_actor_profile_id: string;
          p_actor_role: UserRole;
        };
        Returns: undefined;
      };
      create_batch_with_audit: {
        Args: {
          p_batch_code: string;
          p_name: string;
          p_program_id: string;
          p_location_id: string | null;
          p_training_mode: TrainingMode;
          p_level: string | null;
          p_primary_coach_id: string | null;
          p_capacity: number | null;
          p_start_date: string | null;
          p_end_date: string | null;
          p_actor_profile_id: string;
          p_actor_role: UserRole;
        };
        Returns: string;
      };
      create_enrollment_with_audit: {
        Args: {
          p_student_id: string;
          p_program_id: string;
          p_batch_id: string | null;
          p_notes: string | null;
          p_actor_profile_id: string;
          p_actor_role: UserRole;
        };
        Returns: string;
      };
      // PHASE 11 — narrow, self-scoped coach display for the student
      // portal (see supabase/migrations/0016_student_portal_rls.sql).
      // Takes no arguments: always scoped to auth.uid() internally.
      get_student_batch_coaches: {
        Args: Record<string, never>;
        Returns: StudentBatchCoachRow[];
      };
      // PHASE 12 — narrow, relationship-scoped coach display for the
      // parent portal (see supabase/migrations/0017_parent_portal_rls.sql).
      // Authorization against target_student_id is enforced inside the
      // function body via parent_has_student(), not by the caller.
      get_parent_linked_student_batch_coaches: {
        Args: { target_student_id: string };
        Returns: ParentBatchCoachRow[];
      };
      // PHASE 13 — narrow, self-scoped student roster for the coach
      // portal (see supabase/migrations/0018_coach_portal_rls.sql).
      // Authorization against target_batch_id is enforced inside the
      // function body via coach_has_batch(), not by the caller.
      get_coach_batch_roster: {
        Args: { target_batch_id: string };
        Returns: CoachRosterStudentRow[];
      };
      // PHASE 14 — the only path that changes class_sessions.status (see
      // supabase/migrations/0020_attendance_rls.sql). Verifies COACH +
      // coach_has_batch(session.batch_id) internally; allows only
      // SCHEDULED -> COMPLETED/CANCELLED.
      transition_class_session_status: {
        Args: { target_session_id: string; target_status: SessionStatus };
        Returns: SessionStatus;
      };
      // PHASE 14 — the only path that writes attendance_records. Validates
      // the entire payload and every student's session-date eligibility
      // before writing anything; rejects the whole call on any single
      // unauthorized/invalid entry. Returns the number of rows upserted.
      mark_session_attendance: {
        Args: { target_session_id: string; attendance_payload: Record<string, unknown>[] };
        Returns: number;
      };
      // PHASE 14 — narrow, self-scoped roster+attendance merge for the
      // coach's attendance-marking page. Authorization enforced inside
      // via coach_has_batch(), not by the caller.
      get_coach_session_attendance: {
        Args: { target_session_id: string };
        Returns: CoachSessionAttendanceRow[];
      };
      // PHASE 14 — narrow, self-scoped dated-session + attendance list for
      // the student portal. Zero-argument: always scoped to
      // current_student_id() internally.
      get_student_attendance: {
        Args: Record<string, never>;
        Returns: StudentAttendanceRow[];
      };
      // PHASE 14 — narrow, relationship-scoped equivalent for the parent
      // portal. Authorization enforced inside via parent_has_student(),
      // not by the caller.
      get_parent_student_attendance: {
        Args: { target_student_id: string };
        Returns: ParentAttendanceRow[];
      };
      // PHASE 15 — the only path that creates student_progress_evaluations
      // (see supabase/migrations/0022_student_progress_rls.sql). Verifies
      // COACH + ACTIVE status + coach_has_batch(target_batch_id) +
      // student_in_batch_roster(); validates period/text-lengths/area-
      // ratings; derives coach_id/created_by/program_id server-side.
      create_student_progress_evaluation: {
        Args: {
          target_student_id: string;
          target_batch_id: string;
          target_program_id: string | null;
          period_start: string;
          period_end: string;
          summary: string | null;
          strengths_text: string | null;
          development_focus_text: string | null;
          recommendation_text: string | null;
          area_ratings: Record<string, unknown>[];
        };
        Returns: string;
      };
      // PHASE 15 — the only path that edits an existing DRAFT evaluation.
      // Never changes student_id/batch_id/program_id/coach_id/created_by/
      // status/published fields. Replaces area ratings atomically.
      update_student_progress_evaluation: {
        Args: {
          target_evaluation_id: string;
          period_start: string;
          period_end: string;
          summary: string | null;
          strengths_text: string | null;
          development_focus_text: string | null;
          recommendation_text: string | null;
          area_ratings: Record<string, unknown>[];
        };
        Returns: boolean;
      };
      // PHASE 15 — the only path DRAFT -> PUBLISHED. Requires >=1 area
      // rating and a non-empty overall_summary; sets published_at/
      // published_by server-side.
      publish_student_progress_evaluation: {
        Args: { target_evaluation_id: string };
        Returns: ProgressEvaluationStatus;
      };
      // PHASE 15 — the only Coach Portal path DRAFT -> ARCHIVED. Never
      // allows archiving a PUBLISHED evaluation.
      archive_student_progress_evaluation: {
        Args: { target_evaluation_id: string };
        Returns: ProgressEvaluationStatus;
      };
      // PHASE 15 — coach-wide evaluation list under the coach historical
      // read rule (coach_id = current coach OR coach_has_batch(batch_id)).
      get_coach_progress_evaluations: {
        Args: Record<string, never>;
        Returns: CoachProgressListRow[];
      };
      // PHASE 15 — single evaluation detail + aggregated area ratings,
      // under the coach historical read rule.
      get_coach_progress_evaluation: {
        Args: { target_evaluation_id: string };
        Returns: CoachProgressDetailRow[];
      };
      // PHASE 15 — batch-scoped evaluation list. Requires
      // coach_has_batch(target_batch_id); shows every evaluation for that
      // batch under the documented continuity decision.
      get_coach_batch_progress: {
        Args: { target_batch_id: string };
        Returns: CoachBatchProgressRow[];
      };
      // PHASE 15 — one student's evaluation history within one batch.
      // Requires coach_has_batch(target_batch_id) + student_in_batch_roster().
      get_coach_student_progress: {
        Args: { target_batch_id: string; target_student_id: string };
        Returns: CoachStudentProgressRow[];
      };
      // PHASE 15 — narrow, self-scoped PUBLISHED-only evaluation list for
      // the student portal. Zero-argument: always scoped to
      // current_student_id() internally.
      get_student_progress_evaluations: {
        Args: Record<string, never>;
        Returns: StudentProgressRow[];
      };
      // PHASE 15 — narrow, relationship-scoped equivalent for the parent
      // portal. Authorization enforced inside via parent_has_student(),
      // not by the caller.
      get_parent_student_progress_evaluations: {
        Args: { target_student_id: string };
        Returns: ParentProgressRow[];
      };
      // PHASE 16 — the only path that creates assignments (see
      // supabase/migrations/0024_assignments_rls.sql). Verifies COACH +
      // ACTIVE status + coach_has_batch(target_batch_id); for STUDENT
      // audience additionally verifies student_in_batch_roster();
      // derives coach_id/created_by/program_id server-side; always
      // inserts as DRAFT.
      create_assignment: {
        Args: {
          target_title: string;
          target_description: string;
          target_instructions: string | null;
          target_audience_type: AssignmentAudienceType;
          target_batch_id: string;
          target_student_id: string | null;
          target_program_id: string | null;
          target_session_id: string | null;
          target_due_at: string | null;
          target_allow_late_submission: boolean;
        };
        Returns: string;
      };
      // PHASE 16 — the only path that edits an existing DRAFT
      // assignment. Never changes audience_type/batch_id/student_id/
      // coach_id/created_by/status/published fields.
      update_assignment: {
        Args: {
          target_assignment_id: string;
          target_title: string;
          target_description: string;
          target_instructions: string | null;
          target_program_id: string | null;
          target_session_id: string | null;
          target_due_at: string | null;
          target_allow_late_submission: boolean;
        };
        Returns: boolean;
      };
      // PHASE 16 — the only path DRAFT -> PUBLISHED. Atomically
      // snapshots assignment_recipients (BATCH: full current roster,
      // rejecting NO_RECIPIENTS if empty; STUDENT: exactly one
      // authorized student); sets published_at/published_by
      // server-side.
      publish_assignment: {
        Args: { target_assignment_id: string };
        Returns: AssignmentStatus;
      };
      // PHASE 16 — the only Coach Portal path DRAFT|PUBLISHED ->
      // ARCHIVED. Never allows ARCHIVED -> anything. Preserves
      // existing recipients/submissions.
      archive_assignment: {
        Args: { target_assignment_id: string };
        Returns: AssignmentStatus;
      };
      // PHASE 16 — the only path that writes assignment_submissions for
      // a student. Verifies STUDENT + assignment_recipients membership
      // + status=PUBLISHED + deadline/late-submission rule + content
      // requirement + URL protocol. student_id/status/submitted_at/
      // reviewed_by/reviewed_at are always server-derived.
      submit_assignment: {
        Args: {
          target_assignment_id: string;
          target_submission_text: string | null;
          target_submission_url: string | null;
        };
        Returns: string;
      };
      // PHASE 16 — the only path a coach reviews a submission.
      // Author-only mutation (stricter than the coach historical read
      // rule) — a continuity-only coach cannot overwrite the author's
      // feedback. Coach may set only REVIEWED/REVISION_REQUESTED, never
      // SUBMITTED.
      review_assignment_submission: {
        Args: {
          target_submission_id: string;
          target_status: AssignmentSubmissionStatus;
          target_feedback: string | null;
        };
        Returns: AssignmentSubmissionStatus;
      };
      // PHASE 16 — coach-wide assignment list under the coach
      // historical read rule.
      get_coach_assignments: {
        Args: Record<string, never>;
        Returns: CoachAssignmentListRow[];
      };
      // PHASE 16 — single assignment detail under the coach historical
      // read rule.
      get_coach_assignment: {
        Args: { target_assignment_id: string };
        Returns: CoachAssignmentDetailRow[];
      };
      // PHASE 16 — batch-scoped assignment list. Requires
      // coach_has_batch(target_batch_id); shows every assignment for
      // that batch under the documented continuity decision.
      get_coach_batch_assignments: {
        Args: { target_batch_id: string };
        Returns: CoachBatchAssignmentRow[];
      };
      // PHASE 16 — recipient roster + narrow submission state for one
      // assignment.
      get_coach_assignment_submissions: {
        Args: { target_assignment_id: string };
        Returns: CoachAssignmentSubmissionRow[];
      };
      // PHASE 16 — single submission detail. Requires
      // submission.assignment_id = target_assignment_id and assignment
      // visibility under the coach historical read rule.
      get_coach_assignment_submission: {
        Args: { target_assignment_id: string; target_submission_id: string };
        Returns: CoachAssignmentSubmissionDetailRow[];
      };
      // PHASE 16 — narrow, self-scoped assignment list for the student
      // portal. Zero-argument: always scoped to current_student_id()
      // internally. Read authorization derives from
      // assignment_recipients, never live batch membership.
      get_student_assignments: {
        Args: Record<string, never>;
        Returns: StudentAssignmentRow[];
      };
      // PHASE 16 — single assignment detail + the current student's own
      // submission only.
      get_student_assignment: {
        Args: { target_assignment_id: string };
        Returns: StudentAssignmentDetailRow[];
      };
      // PHASE 16 — narrow, relationship-scoped equivalent for the
      // parent portal. Authorization enforced inside via
      // parent_has_student(), not by the caller.
      get_parent_student_assignments: {
        Args: { target_student_id: string };
        Returns: ParentAssignmentRow[];
      };
      // PHASE 16 — relationship-scoped single assignment detail + the
      // linked student's own submission only.
      get_parent_student_assignment: {
        Args: { target_student_id: string; target_assignment_id: string };
        Returns: ParentAssignmentDetailRow[];
      };
      // PHASE 17 — narrow admin-only student lookup shared by the
      // certificate and achievement "new record" forms. Never returns
      // contact PII; caps results at 20.
      search_students_for_admin_record: {
        Args: { target_query: string };
        Returns: AdminStudentSearchResultRow[];
      };
      // PHASE 17 — the only path that creates student_certificates.
      // ADMIN/SUPER_ADMIN only (verified via current_admin_profile_id());
      // inserts DRAFT with certificate_number/issued_on/issued_by all
      // null.
      create_student_certificate: {
        Args: {
          target_student_id: string;
          target_certificate_type: CertificateType;
          target_title: string;
          target_description: string | null;
          target_program_id: string | null;
          target_tournament_id: string | null;
          target_achievement_id: string | null;
        };
        Returns: string;
      };
      // PHASE 17 — DRAFT-only certificate content/context update. Never
      // allows changing student_id/status/certificate_number/created_by/
      // issued_on/issued_by/revoked_at/revoked_by.
      update_student_certificate: {
        Args: {
          target_certificate_id: string;
          target_certificate_type: CertificateType;
          target_title: string;
          target_description: string | null;
          target_program_id: string | null;
          target_tournament_id: string | null;
          target_achievement_id: string | null;
        };
        Returns: undefined;
      };
      // PHASE 17 — the only path DRAFT -> ISSUED. Generates
      // certificate_number server-side via a catch-and-retry loop around
      // the UPDATE statement (see docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
      // "Certificate Number Architecture").
      issue_student_certificate: {
        Args: { target_certificate_id: string; target_issued_on: string };
        Returns: undefined;
      };
      // PHASE 17 — the only path ISSUED -> REVOKED. Never clears
      // certificate_number/issued_on; requires a non-empty
      // revocation_reason.
      revoke_student_certificate: {
        Args: { target_certificate_id: string; target_revocation_reason: string };
        Returns: undefined;
      };
      // PHASE 17 — the only path that creates student_achievements.
      // ADMIN/SUPER_ADMIN only; inserts DRAFT with published_at/
      // published_by null.
      create_student_achievement: {
        Args: {
          target_student_id: string;
          target_achievement_type: AchievementType;
          target_title: string;
          target_description: string | null;
          target_achievement_date: string | null;
          target_program_id: string | null;
          target_tournament_id: string | null;
          target_placement: number | null;
          target_external_organization: string | null;
        };
        Returns: string;
      };
      // PHASE 17 — DRAFT-only achievement content/context update. Never
      // allows changing student_id/status/created_by/published_at/
      // published_by.
      update_student_achievement: {
        Args: {
          target_achievement_id: string;
          target_achievement_type: AchievementType;
          target_title: string;
          target_description: string | null;
          target_achievement_date: string | null;
          target_program_id: string | null;
          target_tournament_id: string | null;
          target_placement: number | null;
          target_external_organization: string | null;
        };
        Returns: undefined;
      };
      // PHASE 17 — the only path DRAFT -> PUBLISHED. Never auto-creates a
      // certificate.
      publish_student_achievement: {
        Args: { target_achievement_id: string };
        Returns: undefined;
      };
      // PHASE 17 — the only path DRAFT|PUBLISHED -> ARCHIVED. Never
      // reverts to DRAFT/PUBLISHED.
      archive_student_achievement: {
        Args: { target_achievement_id: string };
        Returns: undefined;
      };
      // PHASE 17 — admin-wide certificate list. Narrow columns only; no
      // student contact PII, no created_by/issued_by/revoked_by UUIDs.
      get_admin_certificates: {
        Args: Record<string, never>;
        Returns: AdminCertificateListRow[];
      };
      // PHASE 17 — single certificate detail for
      // /admin/certificates/[certificateId].
      get_admin_certificate: {
        Args: { target_certificate_id: string };
        Returns: AdminCertificateDetailRow[];
      };
      // PHASE 17 — admin-wide achievement list.
      get_admin_achievements: {
        Args: Record<string, never>;
        Returns: AdminAchievementListRow[];
      };
      // PHASE 17 — single achievement detail for
      // /admin/achievements/[achievementId].
      get_admin_achievement: {
        Args: { target_achievement_id: string };
        Returns: AdminAchievementDetailRow[];
      };
      // PHASE 17 — narrow, self-scoped certificate list for the student
      // portal. Zero-argument: always scoped to current_student_id()
      // internally. DRAFT never appears (status IN ('ISSUED','REVOKED')
      // only).
      get_student_certificates: {
        Args: Record<string, never>;
        Returns: StudentCertificateListRow[];
      };
      // PHASE 17 — single certificate detail. Requires
      // certificate.student_id = current_student_id() AND status IN
      // ('ISSUED','REVOKED') — knowing the certificateId is not enough.
      get_student_certificate: {
        Args: { target_certificate_id: string };
        Returns: StudentCertificateDetailRow[];
      };
      // PHASE 17 — narrow, self-scoped achievement list for the student
      // portal. DRAFT never appears (status IN ('PUBLISHED','ARCHIVED')
      // only).
      get_student_achievements: {
        Args: Record<string, never>;
        Returns: StudentAchievementListRow[];
      };
      // PHASE 17 — single achievement detail under the same visibility
      // rule as get_student_achievements.
      get_student_achievement: {
        Args: { target_achievement_id: string };
        Returns: StudentAchievementDetailRow[];
      };
      // PHASE 17 — narrow, relationship-scoped equivalent for the parent
      // portal. Authorization enforced inside via parent_has_student(),
      // not by the caller.
      get_parent_student_certificates: {
        Args: { target_student_id: string };
        Returns: ParentCertificateListRow[];
      };
      // PHASE 17 — relationship-scoped single certificate detail under
      // the same ISSUED/REVOKED-only visibility rule.
      get_parent_student_certificate: {
        Args: { target_student_id: string; target_certificate_id: string };
        Returns: StudentCertificateDetailRow[];
      };
      // PHASE 17 — narrow, relationship-scoped equivalent for the parent
      // portal. Authorization enforced inside via parent_has_student(),
      // not by the caller.
      get_parent_student_achievements: {
        Args: { target_student_id: string };
        Returns: ParentAchievementListRow[];
      };
      // PHASE 17 — relationship-scoped single achievement detail under
      // the same PUBLISHED/ARCHIVED-only visibility rule.
      get_parent_student_achievement: {
        Args: { target_student_id: string; target_achievement_id: string };
        Returns: StudentAchievementDetailRow[];
      };
      // PHASE 18 — the only path that starts certificate document
      // generation. ADMIN only. Requires certificate.status = ISSUED.
      // Concurrent calls for the same certificate are rejected with
      // GENERATION_IN_PROGRESS via the partial unique index.
      begin_certificate_document_generation: {
        Args: { target_certificate_id: string };
        Returns: BeginCertificateGenerationRow[];
      };
      // PHASE 18 — ADMIN-only narrow PDF generation input. Never returns
      // student contact PII/parent data/payment data/internal profile UUIDs.
      get_certificate_generation_context: {
        Args: { target_certificate_id: string };
        Returns: CertificateGenerationContextRow[];
      };
      // PHASE 18 — the only path GENERATING -> AVAILABLE. Supersedes any
      // prior AVAILABLE document for the same certificate only after this
      // one is confirmed AVAILABLE.
      finalize_certificate_document_generation: {
        Args: {
          target_document_id: string;
          target_storage_key: string;
          target_mime_type: string;
          target_file_size_bytes: number;
          target_sha256_checksum: string;
        };
        Returns: boolean;
      };
      // PHASE 18 — the only path GENERATING -> FAILED. Accepts only a
      // closed set of safe internal error codes. Never supersedes a
      // previous AVAILABLE document.
      fail_certificate_document_generation: {
        Args: { target_document_id: string; target_error_code: string };
        Returns: boolean;
      };
      // PHASE 18 — admin document version history. Never exposes
      // storage_key/storage_bucket/checksum/generated_by.
      get_admin_certificate_documents: {
        Args: { target_certificate_id: string };
        Returns: AdminCertificateDocumentRow[];
      };
      // PHASE 18 — student document availability boolean only, never
      // storage metadata.
      get_student_certificate_document_availability: {
        Args: { target_certificate_id: string };
        Returns: boolean;
      };
      // PHASE 18 — parent document availability boolean only.
      // Authorization enforced inside via parent_has_student().
      get_parent_student_certificate_document_availability: {
        Args: { target_student_id: string; target_certificate_id: string };
        Returns: boolean;
      };
      // PHASE 18 — server-only download authorization + resolution.
      // Requires certificate.status = ISSUED and an AVAILABLE document.
      // Authorizes ADMIN/SUPER_ADMIN, the owning Student, or a linked
      // Parent only. Never called from a Client Component.
      resolve_certificate_download: {
        Args: { target_certificate_id: string };
        Returns: CertificateDownloadResolutionRow[];
      };
      // ACCEPT INVITE — the only path that flips profiles.active true as
      // part of invite acceptance (see
      // supabase/migrations/0029_profile_activation.sql). Zero-argument:
      // always scoped to auth.uid() internally. Returns true only when
      // this call was the one that actually activated the profile; false
      // for an already-activated profile or no matching row — never an
      // error for either of those two ordinary cases.
      activate_own_profile: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
