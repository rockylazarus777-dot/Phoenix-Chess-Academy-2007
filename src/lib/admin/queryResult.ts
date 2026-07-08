import "server-only";

/**
 * Every admin query module function returns this shape so callers (page
 * components) can honestly distinguish "the database is unavailable"
 * from "the query succeeded and returned zero rows" — see Phase 10's
 * Admin Home spec: "Differentiate: 0 records from database unavailable.
 * Do not display zero as though it were confirmed academy data."
 */
export type AdminQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "DATABASE_UNAVAILABLE" | "UNKNOWN" };

export function queryOk<T>(data: T): AdminQueryResult<T> {
  return { ok: true, data };
}

export function queryUnavailable<T>(): AdminQueryResult<T> {
  return { ok: false, code: "DATABASE_UNAVAILABLE" };
}

export function queryUnknownError<T>(): AdminQueryResult<T> {
  return { ok: false, code: "UNKNOWN" };
}
