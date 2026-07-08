/**
 * Student-portal equivalent of the admin `AdminQueryResult<T>` pattern
 * (src/lib/admin/queryResult.ts) — kept as its own small type rather
 * than imported from `src/lib/admin`, since the portal and admin areas
 * are deliberately decoupled. `STUDENT_NOT_LINKED`/`ACCESS_DENIED` are
 * NOT part of this type: those are resolved once, up front, by
 * `getCurrentStudent()` — by the time a page calls one of the
 * `src/lib/queries/student/*.ts` functions, identity is already known
 * to be `OK`, so a per-query result only ever needs to distinguish
 * "got data" from "database unavailable" or "something unexpected
 * happened".
 */
export type StudentQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "DATABASE_UNAVAILABLE" | "UNKNOWN" };

export function studentQueryOk<T>(data: T): StudentQueryResult<T> {
  return { ok: true, data };
}

export function studentQueryUnavailable<T>(): StudentQueryResult<T> {
  return { ok: false, code: "DATABASE_UNAVAILABLE" };
}

export function studentQueryUnknownError<T>(): StudentQueryResult<T> {
  return { ok: false, code: "UNKNOWN" };
}
