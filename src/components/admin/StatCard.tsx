import Link from "next/link";
import type { AdminQueryResult } from "@/lib/admin/queryResult";

interface StatCardProps {
  label: string;
  href: string;
  result: AdminQueryResult<number> | null;
}

/**
 * A single overview stat. `result === null` means the caller lacks
 * permission to view this metric — the card is omitted entirely by the
 * page, not shown-and-blanked, so there is no card that hints at data
 * the viewer can't see. When `result` is present, this distinguishes
 * "0 records" from "database unavailable" rather than showing "0" for
 * both — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Admin Home".
 */
export function StatCard({ label, href, result }: StatCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <p className="text-body-sm text-muted-foreground">{label}</p>
      {result === null ? (
        <p className="mt-2 text-h4 text-muted-foreground">—</p>
      ) : result.ok ? (
        <p className="mt-2 text-h3 text-foreground">{result.data.toLocaleString()}</p>
      ) : (
        <p className="mt-2 text-body-sm text-danger">Database unavailable</p>
      )}
    </Link>
  );
}
