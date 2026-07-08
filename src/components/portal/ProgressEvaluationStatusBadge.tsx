import type { ProgressEvaluationStatus } from "@/lib/supabase/types";

const TONE_CLASSES: Record<"neutral" | "positive", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
};

const STATUS_TONES: Record<ProgressEvaluationStatus, "neutral" | "positive"> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  ARCHIVED: "neutral",
};

const STATUS_LABELS: Record<ProgressEvaluationStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/**
 * A `student_progress_evaluations.status` badge — deliberately its own
 * component, never reused for `AttendanceStatusBadge`/`SessionStatusBadge`/
 * a tournament status badge, since evaluation-status semantics (DRAFT
 * working copy / PUBLISHED visible-to-family / ARCHIVED historical) are
 * genuinely different. Shared across the Coach, Student, and Parent
 * Portals (kept at `src/components/portal/`, not under a role subfolder)
 * because the status text itself is not PII — every caller already
 * resolves the evaluation's visibility (DRAFT/ARCHIVED never reach
 * Student/Parent at all) before this badge is ever rendered. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Progress Status Presentation".
 * Status is always rendered as text plus a tone color, never color alone.
 */
export function ProgressEvaluationStatusBadge({ status }: { status: ProgressEvaluationStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
