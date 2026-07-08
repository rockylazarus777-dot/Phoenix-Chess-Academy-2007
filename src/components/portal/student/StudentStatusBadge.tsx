const TONE_CLASSES: Record<"neutral" | "positive" | "warning" | "negative", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  warning: "border-warning/50 text-warning",
  negative: "border-danger/50 text-danger",
};

/**
 * Generic, tone-based status presentation — deliberately NOT the public
 * `src/components/ui/StatusBadge.tsx` (which is tournament-status-typed
 * only) and not imported from `src/components/admin` (portal and admin
 * stay decoupled). Status is always a labeled badge — text plus a
 * border color — never a bare color dot, so status is never
 * communicated by color alone.
 */
export function StudentStatusBadge({
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

export function studentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return STUDENT_STATUS_TONES[status] ?? "neutral";
}

export function enrollmentStatusTone(status: string): "neutral" | "positive" | "warning" | "negative" {
  return ENROLLMENT_STATUS_TONES[status] ?? "neutral";
}
