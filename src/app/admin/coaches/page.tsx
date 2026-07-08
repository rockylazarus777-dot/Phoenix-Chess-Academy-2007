import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listCoaches } from "@/lib/queries/admin/coaches";
import { parsePaginationParams, sanitizeSearchQuery } from "@/lib/admin/pagination";
import { coachStatusValues } from "@/lib/validation/admin/coach";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";

export const metadata = buildMetadata({ title: "Coaches", description: "Manage Phoenix Chess Academy coaches.", path: "/admin/coaches", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string }>;
}

export default async function AdminCoachesPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_COACHES");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const query = sanitizeSearchQuery(sp.q);
  const status = (coachStatusValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof coachStatusValues)[number]) : null;

  const result = await listCoaches({ page, pageSize, query, status });

  return (
    <div>
      <AdminPageHeader title="Coaches" description="Business records for Phoenix Chess Academy coaches." action={{ href: "/admin/coaches/new", label: "Add coach" }} />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-body-sm font-medium text-foreground">
            Search
          </label>
          <input id="q" name="q" defaultValue={query ?? ""} placeholder="Name, code, email" className={`${inputClasses} w-64`} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-body-sm font-medium text-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">All statuses</option>
            {coachStatusValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-11 rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground hover:opacity-90">
          Apply
        </button>
      </form>

      {!result.ok ? (
        <AdminQueryError code={result.code} />
      ) : result.data.rows.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">No coaches match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Coach code</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Contact</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.coach_code}</td>
                    <td className="px-4 py-3 text-foreground">{row.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email ?? row.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} tone={toneForStatus("coach", row.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/coaches/${row.id}`} className="text-primary-text hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} totalCount={result.data.totalCount} basePath="/admin/coaches" searchParams={{ q: query ?? undefined, status: status ?? undefined }} />
        </>
      )}
    </div>
  );
}
