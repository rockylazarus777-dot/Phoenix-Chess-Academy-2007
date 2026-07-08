const TONE_CLASSES: Record<"neutral" | "positive" | "warning" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  negative: "border-danger/50 text-danger",
};

/**
 * Generic, tone-based status presentation for the coach portal —
 * structurally identical to `StudentStatusBadge`/`ParentStatusBadge`
 * but kept as its own independent component (portal segments stay
 * decoupled — see docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Status
 * Presentation"). Status is always a labeled badge — text plus a
 * border color — never a bare color dot.
 */
export function CoachStatusBadge({
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

const COACH_STATUS_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
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

const BATCH_STATUS_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  DRAFT: "neutral",
  ACTIVE: "positive",
  PAUSED: "warning",
  COMPLETED: "neutral",
  ARCHIVED: "negative",
};

export function coachStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return COACH_STATUS_TONES[status] ?? "neutral";
}

/** Tone for a roster student's own `student_status`, as displayed inside the coach portal. */
export function rosterStudentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return STUDENT_STATUS_TONES[status] ?? "neutral";
}

export function batchStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return BATCH_STATUS_TONES[status] ?? "neutral";
}
