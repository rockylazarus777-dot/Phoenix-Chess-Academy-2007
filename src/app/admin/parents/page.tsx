import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listParents } from "@/lib/queries/admin/parents";
import { parsePaginationParams, sanitizeSearchQuery } from "@/lib/admin/pagination";
import { parentStatusValues } from "@/lib/validation/admin/parent";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";

export const metadata = buildMetadata({ title: "Parents", description: "Manage Phoenix Chess Academy parents and guardians.", path: "/admin/parents", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string }>;
}

export default async function AdminParentsPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_PARENTS");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const query = sanitizeSearchQuery(sp.q);
  const status = (parentStatusValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof parentStatusValues)[number]) : null;

  const result = await listParents({ page, pageSize, query, status });

  return (
    <div>
      <AdminPageHeader
        title="Parents"
        description="Business records for parents and guardians. Note: email is not unique — families may share or omit an email address."
        action={{ href: "/admin/parents/new", label: "Add parent" }}
      />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-body-sm font-medium text-foreground">
            Search
          </label>
          <input id="q" name="q" defaultValue={query ?? ""} placeholder="Name, phone, email" className={`${inputClasses} w-64`} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-body-sm font-medium text-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">All statuses</option>
            {parentStatusValues.map((value) => (
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
        <p className="mt-8 text-body-sm text-muted-foreground">No parents match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Phone</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{row.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} tone={toneForStatus("parent", row.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/parents/${row.id}`} className="text-primary-text hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} totalCount={result.data.totalCount} basePath="/admin/parents" searchParams={{ q: query ?? undefined, status: status ?? undefined }} />
        </>
      )}
    </div>
  );
}
