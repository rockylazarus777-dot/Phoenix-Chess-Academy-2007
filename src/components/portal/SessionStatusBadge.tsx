import type { SessionStatus } from "@/lib/supabase/types";

const TONE_CLASSES: Record<"neutral" | "positive" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  negative: "border-danger/50 text-danger",
};

const SESSION_STATUS_TONES: Record<SessionStatus, "neutral" | "positive" | "negative"> = {
  SCHEDULED: "neutral",
  COMPLETED: "positive",
  CANCELLED: "negative",
};

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/**
 * A `class_sessions.status` badge — deliberately its own component, never
 * mixed with `AttendanceStatusBadge`. Shared across the Coach, Student,
 * and Parent Portals (kept at `src/components/portal/`, not under a
 * role subfolder) because session status is genuinely shared, non-PII,
 * academy-wide operational data — unlike `CoachStatusBadge`/
 * `StudentStatusBadge`/`ParentStatusBadge`, which describe a specific
 * person and are deliberately kept decoupled per portal. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session Status
 * Presentation". Status is always rendered as text plus a tone color,
 * never color alone.
 */
export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[SESSION_STATUS_TONES[status]]}`}>
      {SESSION_STATUS_LABELS[status]}
    </span>
  );
}
