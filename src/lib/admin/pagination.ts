import "server-only";

/**
 * Shared server-side pagination for every admin list page. Phoenix has
 * 5,000+ students — no admin list ever fetches an unbounded result set;
 * every query module calls `toRange()` and passes it straight to
 * Supabase's `.range()`.
 */
export const DEFAULT_PAGE_SIZE = 25;
export const ALLOWED_PAGE_SIZES = [25, 50] as const;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Parses `?page=`/`?pageSize=` from a page's searchParams. Invalid or
 * out-of-range values fall back safely rather than being trusted
 * directly — an admin list page never lets an arbitrary `pageSize=99999`
 * query string force a huge fetch.
 */
export function parsePaginationParams(searchParams: { page?: string; pageSize?: string }): PaginationParams {
  const parsedPage = Number.parseInt(searchParams.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedPageSize = Number.parseInt(searchParams.pageSize ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(parsedPageSize) ? parsedPageSize : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

/** Converts a 1-indexed page + page size into a Supabase `.range(from, to)` pair. */
export function toRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

export function totalPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/**
 * Validates a free-text search query: trims, enforces a sane max
 * length, and returns `null` for an effectively-empty query. Does not
 * attempt to strip characters — search always goes through Supabase's
 * parameterized query builder (`.ilike()`/`.or()`), never raw SQL
 * string interpolation, so there is no injection surface to sanitize
 * against here; this is purely a usability/DoS-limit guard.
 */
export function sanitizeSearchQuery(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 100);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates a requested sort column against an explicit allow-list —
 * never trusts an arbitrary `?sort=` query value as a column name.
 */
export function resolveSortColumn<T extends string>(requested: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(requested ?? "") ? (requested as T) : fallback;
}
