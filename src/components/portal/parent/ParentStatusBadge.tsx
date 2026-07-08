const TONE_CLASSES: Record<"neutral" | "positive" | "warning" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  negative: "border-danger/50 text-danger",
};

/**
 * Generic, tone-based status presentation for the parent portal —
 * structurally identical to
 * `src/components/portal/student/StudentStatusBadge.tsx`, but kept as
 * its own independent component rather than imported from the student
 * portal (portal segments stay decoupled; see
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Status Presentation" for
 * why this small, low-risk duplication was preferred over refactoring
 * the already-shipped student component into a shared primitive).
 * Status is always a labeled badge — text plus a border color — never
 * a bare color dot.
 */
export function ParentStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "positive" | "warning" | "negative";
}) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>{label}</span>
  );
}

const PARENT_STATUS_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  INACTIVE: "negative",
  ARCHIVED: "negative",
};

const STUDENT_STATUS_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  ON_HOLD: "warning",
  ALUMNI: "neutral",
  INACTIVE: "negative",
  ARCHIVED: "negative",
};

const ENROLLMENT_STATUS_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  PAUSED: "warning",
  COMPLETED: "neutral",
  WITHDRAWN: "negative",
  CANCELLED: "negative",
};

export function parentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return PARENT_STATUS_TONES[status] ?? "neutral";
}

/** Tone for a linked student's own `student_status`, as displayed inside the parent portal. */
export function linkedStudentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return STUDENT_STATUS_TONES[status] ?? "neutral";
}

export function parentEnrollmentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return ENROLLMENT_STATUS_TONES[status] ?? "neutral";
}
