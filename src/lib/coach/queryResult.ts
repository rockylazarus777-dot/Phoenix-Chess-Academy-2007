/**
 * Coach-portal equivalent of `StudentQueryResult<T>` /
 * `ParentQueryResult<T>` — kept as its own independent type, since the
 * student, parent, and coach portals are deliberately decoupled.
 * `COACH_NOT_LINKED`/`ACCOUNT_RESTRICTED` are resolved once, up front,
 * by `getCurrentCoach()`; `batchId` authorization is resolved once, up
 * front, by `getAssignedBatch()` (which renders `notFound()` before any
 * of these query functions are ever called) — neither needs to be a
 * state in this narrower per-query result type.
 */
export type CoachQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "DATABASE_UNAVAILABLE" | "UNKNOWN" };

export function coachQueryOk<T>(data: T): CoachQueryResult<T> {
  return { ok: true, data };
}

export function coachQueryUnavailable<T>(): CoachQueryResult<T> {
  return { ok: false, code: "DATABASE_UNAVAILABLE" };
}

export function coachQueryUnknownError<T>(): CoachQueryResult<T> {
  return { ok: false, code: "UNKNOWN" };
}
