import type { AttendanceStatus } from "@/lib/supabase/types";

/** UI-only display value — NEVER persisted to attendance_records.status. A missing attendance row means Not Marked, not a database value. */
export type AttendanceDisplayStatus = AttendanceStatus | "NOT_MARKED";

const TONE_CLASSES: Record<"neutral" | "positive" | "warning" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  negative: "border-danger/50 text-danger",
};

const ATTENDANCE_STATUS_TONES: Record<AttendanceDisplayStatus, "neutral" | "positive" | "warning" | "negative"> = {
  PRESENT: "positive",
  LATE: "warning",
  EXCUSED: "neutral",
  ABSENT: "negative",
  NOT_MARKED: "neutral",
};

const ATTENDANCE_STATUS_LABELS: Record<AttendanceDisplayStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  EXCUSED: "Excused",
  ABSENT: "Absent",
  NOT_MARKED: "Not Marked",
};

/**
 * An attendance-status badge — deliberately its own component, never
 * mixed with `SessionStatusBadge`. Shared across the Coach, Student, and
 * Parent Portals for the same reason `SessionStatusBadge` is: attendance
 * status text itself is not PII, only the association with a specific
 * student is (and every caller already resolves that association through
 * its own privacy-scoped query/RPC before ever rendering this badge). See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Attendance Status
 * Presentation". `NOT_MARKED` is a UI-only value — see
 * `AttendanceDisplayStatus` — and is never written to the database.
 * Status is always rendered as text plus a tone color, never color alone.
 */
export function AttendanceStatusBadge({ status }: { status: AttendanceDisplayStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[ATTENDANCE_STATUS_TONES[status]]}`}
    >
      {ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}
