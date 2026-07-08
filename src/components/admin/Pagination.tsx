import Link from "next/link";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  /** Base path, e.g. "/admin/students". Existing query params are preserved except `page`. */
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function buildHref(basePath: string, searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key !== "page" && value) params.set(key, value);
  });
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

/** Server-rendered pager — no client JS required. Page/query/filters all travel as URL params, validated server-side by the page before querying. */
export function Pagination({ page, pageSize, totalCount, basePath, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-body-sm text-muted-foreground">
        Page {page} of {totalPages} &middot; {totalCount.toLocaleString()} total
      </p>
      <div className="flex gap-2">
        {prevDisabled ? (
          <span className="rounded-md border border-border px-3 py-1.5 text-body-sm text-muted-foreground">Previous</span>
        ) : (
          <Link
            href={buildHref(basePath, searchParams, page - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-body-sm text-foreground hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Previous
          </Link>
        )}
        {nextDisabled ? (
          <span className="rounded-md border border-border px-3 py-1.5 text-body-sm text-muted-foreground">Next</span>
        ) : (
          <Link
            href={buildHref(basePath, searchParams, page + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-body-sm text-foreground hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
