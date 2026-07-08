import "server-only";

export interface SubmissionResult {
  success: boolean;
  message: string;
  id?: string;
}

/** Converts a possibly-empty/possibly-non-numeric optional string field (e.g. FIDE rating) into an integer or null — never NaN. */
export function parseOptionalInt(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Normalizes an optional string field to null when empty/undefined, so we never send an empty string where the database expects null. */
export function emptyToNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
