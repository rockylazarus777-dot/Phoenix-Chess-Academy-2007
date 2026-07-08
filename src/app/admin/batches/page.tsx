import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listBatches } from "@/lib/queries/admin/batches";
import { parsePaginationParams, sanitizeSearchQuery } from "@/lib/admin/pagination";
import { batchStatusValues } from "@/lib/validation/admin/batch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";

export const metadata = buildMetadata({ title: "Batches", description: "Manage Phoenix Chess Academy training batches.", path: "/admin/batches", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string }>;
}

export default async function AdminBatchesPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_BATCHES");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const query = sanitizeSearchQuery(sp.q);
  const status = (batchStatusValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof batchStatusValues)[number]) : null;

  const result = await listBatches({ page, pageSize, query, status });

  return (
    <div>
      <AdminPageHeader title="Batches" description="Training groups students are assigned to." action={{ href: "/admin/batches/new", label: "Add batch" }} />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-body-sm font-medium text-foreground">
            Search
          </label>
          <input id="q" name="q" defaultValue={query ?? ""} placeholder="Batch code or name" className={`${inputClasses} w-64`} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-body-sm font-medium text-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">All statuses</option>
            {batchStatusValues.map((value) => (
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
        <p className="mt-8 text-body-sm text-muted-foreground">No batches match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Batch code</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Program</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Mode</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.batch_code}</td>
                    <td className="px-4 py-3 text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.program_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.training_mode}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} tone={toneForStatus("batch", row.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/batches/${row.id}`} className="text-primary-text hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} totalCount={result.data.totalCount} basePath="/admin/batches" searchParams={{ q: query ?? undefined, status: status ?? undefined }} />
        </>
      )}
    </div>
  );
}
