const TONE_CLASSES: Record<"neutral" | "positive" | "warning" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  negative: "border-danger/50 text-danger",
};

/**
 * Status is always shown as a labeled badge (text + border), never as a
 * bare color swatch or dot — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Accessibility": no color-alone status indication.
 */
export function StatusBadge({ status, tone }: { status: string; tone: "neutral" | "positive" | "warning" | "negative" }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {status}
    </span>
  );
}

const STUDENT_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  INACTIVE: "neutral",
  ON_HOLD: "warning",
  ALUMNI: "neutral",
  ARCHIVED: "negative",
};

const BATCH_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  DRAFT: "neutral",
  ACTIVE: "positive",
  PAUSED: "warning",
  COMPLETED: "neutral",
  ARCHIVED: "negative",
};

const ENROLLMENT_TONES: Record<string, "neutral" | "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  PAUSED: "warning",
  COMPLETED: "neutral",
  WITHDRAWN: "negative",
  CANCELLED: "negative",
};

export function toneForStatus(kind: "student" | "parent" | "coach" | "batch" | "enrollment", status: string) {
  if (kind === "batch") return BATCH_TONES[status] ?? "neutral";
  if (kind === "enrollment") return ENROLLMENT_TONES[status] ?? "neutral";
  return STUDENT_TONES[status] ?? "neutral";
}
