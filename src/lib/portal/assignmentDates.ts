/**
 * Deterministic, server-rendered due-date formatting for assignments — no
 * browser-only locale formatting (avoids hydration mismatch, per
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Date Display"). Every assignment page
 * in Phase 16 is a Server Component, so `Date.toLocaleString()` here always
 * runs on the server and produces the same output for every viewer,
 * exactly like `src/lib/dates.ts`'s tournament date helpers.
 */
const DATE_LOCALE = "en-IN";

/** `due_at` is optional — null must display as "No deadline," never "Overdue" (overdue is a separate, student-contextual derived state; see `getAssignmentDerivedState`). */
export function formatAssignmentDueDate(dueAt: string | null): string {
  if (!dueAt) return "No deadline";
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleString(DATE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAssignmentTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(DATE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Converts a stored `timestamptz` (ISO string) into the exact
 * `YYYY-MM-DDTHH:mm` shape an `<input type="datetime-local">` requires as
 * its `value` — used only to prefill the coach's edit form with the
 * assignment's own existing `due_at`. Returns an empty string for null
 * (no deadline set).
 */
export function toDatetimeLocalInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Isolates the one impure `Date.now()` read behind a plain (non-component,
 * non-hook) function — React's purity lint rule flags a direct
 * `Date.now()` call inside a Server Component's render body, so every
 * deadline check in a page component must go through this helper instead
 * of comparing `Date.now()` inline. Returns false for a null/invalid
 * `due_at` (no deadline never counts as passed).
 */
export function isAssignmentSubmissionDeadlinePassed(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return Date.now() > due.getTime();
}

export type AssignmentDerivedState = "OPEN" | "OVERDUE" | "CLOSED";

/**
 * UI-only derived state — NEVER persisted as assignment_status.
 * Student-contextual: the same PUBLISHED assignment can be OPEN for one
 * student (submitted) and OVERDUE for another (no submission, deadline
 * passed). See docs/ASSIGNMENTS_ARCHITECTURE.md, "Derived Overdue State".
 *
 * OPEN: due_at is null OR now <= due_at.
 * OVERDUE: due_at < now AND the student has no submission yet.
 * CLOSED: due_at < now AND allow_late_submission = false AND the student
 * has no submission yet — submission is blocked (this project treats
 * CLOSED as a variant of "deadline passed with no late submissions
 * allowed" rather than a third mutually-exclusive display bucket).
 */
export function getAssignmentDerivedState(params: {
  dueAt: string | null;
  allowLateSubmission: boolean;
  hasSubmission: boolean;
}): AssignmentDerivedState {
  const { dueAt, allowLateSubmission, hasSubmission } = params;
  if (!dueAt) return "OPEN";

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "OPEN";

  const isPastDue = Date.now() > due.getTime();
  if (!isPastDue) return "OPEN";
  if (hasSubmission) return "OPEN";
  return allowLateSubmission ? "OVERDUE" : "CLOSED";
}
