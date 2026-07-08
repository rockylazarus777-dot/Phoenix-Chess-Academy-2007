import type { CertificateStatus } from "@/lib/supabase/types";

const TONE_CLASSES: Record<"neutral" | "positive" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  negative: "border-danger/50 text-danger",
};

const STATUS_TONES: Record<CertificateStatus, "neutral" | "positive" | "negative"> = {
  DRAFT: "neutral",
  ISSUED: "positive",
  REVOKED: "negative",
};

const STATUS_LABELS: Record<CertificateStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  REVOKED: "Revoked",
};

/**
 * A `student_certificates.status` badge — deliberately its own component,
 * never reused for `AssignmentStatusBadge`/`ProgressEvaluationStatusBadge`/
 * `AchievementStatusBadge`, since certificate-lifecycle semantics (DRAFT
 * invisible working copy / ISSUED official record / REVOKED permanent,
 * clearly-marked historical record) are genuinely different from any other
 * Phase 14-16 status. Shared across Admin, Student, and Parent — the
 * status text itself is not PII, and every caller already resolves
 * visibility (DRAFT never reaches Student/Parent) before this badge is
 * rendered. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
 * "Certificate Status Presentation". Status is always rendered as text
 * plus a tone color, never color alone, and REVOKED is never shown with a
 * trophy/crown/medal icon implying achievement.
 */
export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
