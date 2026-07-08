/**
 * The ONLY global Coach Portal nav items. Phase 14 added "Class Sessions"
 * because the real `/coach/sessions` route exists; Phase 15 adds "Student
 * Progress" because the real `/coach/progress` route now exists; Phase 16
 * adds "Assignments" because the real `/coach/assignments` route now
 * exists. No item links to Evaluations (as a separate system)/
 * Certificates/Payments/Messages — those systems don't exist yet.
 * Attendance is deliberately NOT a global item — it is contextual to one
 * class session (see `/coach/sessions/[sessionId]/attendance`). A specific
 * assigned batch's Students/Schedule/Sessions/Progress/Assignments are NOT
 * global items either — those are contextual, generated per-batch by
 * `getCoachBatchContextNav()` below. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Global Navigation Items",
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Coach Navigation
 * Update", docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Navigation
 * Update", and docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Navigation
 * Update".
 */
export interface CoachNavItem {
  href: string;
  label: string;
}

export const COACH_NAV_ITEMS: CoachNavItem[] = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/profile", label: "My Profile" },
  { href: "/coach/batches", label: "My Batches" },
  { href: "/coach/sessions", label: "Class Sessions" },
  { href: "/coach/progress", label: "Student Progress" },
  { href: "/coach/assignments", label: "Assignments" },
];

/**
 * Contextual navigation shown only while viewing one assigned batch —
 * generated per-batch since every href is scoped to that batch's UUID.
 * Phase 14 added "Class Sessions" (the real `/coach/batches/[batchId]/
 * sessions` route); Phase 15 added "Student Progress" (the real
 * `/coach/batches/[batchId]/progress` route); Phase 16 adds "Assignments"
 * (the real `/coach/batches/[batchId]/assignments` route). Only real
 * routes; no Attendance/Evaluations entries — Attendance is contextual to
 * one session, not to a batch.
 */
export function getCoachBatchContextNav(batchId: string): CoachNavItem[] {
  const base = `/coach/batches/${batchId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/students`, label: "Students" },
    { href: `${base}/schedule`, label: "Class Schedule" },
    { href: `${base}/sessions`, label: "Class Sessions" },
    { href: `${base}/progress`, label: "Student Progress" },
    { href: `${base}/assignments`, label: "Assignments" },
  ];
}
