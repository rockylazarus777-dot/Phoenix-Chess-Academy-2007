import type { AssignmentStatus } from "@/lib/supabase/types";

const TONE_CLASSES: Record<"neutral" | "positive", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
};

const STATUS_TONES: Record<AssignmentStatus, "neutral" | "positive"> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  ARCHIVED: "neutral",
};

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/**
 * An `assignments.status` badge — deliberately its own component, never
 * reused for `ProgressEvaluationStatusBadge`/`AttendanceStatusBadge`/
 * `SessionStatusBadge`, since assignment-lifecycle semantics (DRAFT working
 * copy / PUBLISHED live homework / ARCHIVED historical, no-new-submissions)
 * are genuinely different. Shared across the Coach, Student, and Parent
 * Portals because the status text itself is not PII — every caller already
 * resolves the assignment's visibility (DRAFT never reaches Student/Parent)
 * before this badge is ever rendered. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Status Presentation".
 * Status is always rendered as text plus a tone color, never color alone.
 */
export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
