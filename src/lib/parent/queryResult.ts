/**
 * Parent-portal equivalent of `src/lib/portal/queryResult.ts`'s
 * `StudentQueryResult<T>` — kept as its own independent type rather than
 * imported/shared, since the student and parent portals are deliberately
 * decoupled (matching how Phase 11 kept `StudentQueryResult` separate
 * from Phase 10's `AdminQueryResult`). `PARENT_NOT_LINKED`/
 * `ACCOUNT_RESTRICTED` are NOT part of this type: those are resolved
 * once, up front, by `getCurrentParent()` — by the time a page calls one
 * of the `src/lib/queries/parent/*.ts` functions, parent identity is
 * already known to be `OK`. `STUDENT_NOT_FOUND` is likewise not part of
 * this type — linked-student authorization is a separate, earlier step
 * (`getLinkedStudent()` in `src/lib/parent/authorization.ts`) that
 * renders `notFound()` before any of these query functions are ever
 * called.
 */
export type ParentQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "DATABASE_UNAVAILABLE" | "UNKNOWN" };

export function parentQueryOk<T>(data: T): ParentQueryResult<T> {
  return { ok: true, data };
}

export function parentQueryUnavailable<T>(): ParentQueryResult<T> {
  return { ok: false, code: "DATABASE_UNAVAILABLE" };
}

export function parentQueryUnknownError<T>(): ParentQueryResult<T> {
  return { ok: false, code: "UNKNOWN" };
}
