import type { AchievementStatus } from "@/lib/supabase/types";

const TONE_CLASSES: Record<"neutral" | "positive", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
};

const STATUS_TONES: Record<AchievementStatus, "neutral" | "positive"> = {
  DRAFT: "neutral",
  PUBLISHED: "positive",
  ARCHIVED: "neutral",
};

const STATUS_LABELS: Record<AchievementStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/**
 * A `student_achievements.status` badge — deliberately its own component,
 * never reused for `ProgressEvaluationStatusBadge`/`AssignmentStatusBadge`/
 * `CertificateStatusBadge`, since achievement-lifecycle semantics (DRAFT
 * invisible working copy / PUBLISHED visible-to-family / ARCHIVED
 * historical but still visible) are genuinely different from every other
 * Phase 14-17 status, even though the DRAFT/PUBLISHED/ARCHIVED labels look
 * similar to assignments — the underlying visibility rules differ (an
 * archived assignment stops accepting submissions; an archived achievement
 * simply stops being "current" while remaining fully visible). Shared
 * across Admin, Student, and Parent. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Achievement Status
 * Presentation". Status is always rendered as text plus a tone color,
 * never color alone.
 */
export function AchievementStatusBadge({ status }: { status: AchievementStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
