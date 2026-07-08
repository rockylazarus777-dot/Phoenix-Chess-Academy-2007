import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listStudents, STUDENT_SORT_COLUMNS, type StudentSortColumn } from "@/lib/queries/admin/students";
import { parsePaginationParams, sanitizeSearchQuery, resolveSortColumn } from "@/lib/admin/pagination";
import { studentStatusValues } from "@/lib/validation/admin/student";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";

export const metadata = buildMetadata({ title: "Students", description: "Manage Phoenix Chess Academy students.", path: "/admin/students", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string; sort?: string }>;
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_STUDENTS");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const query = sanitizeSearchQuery(sp.q);
  const status = (studentStatusValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof studentStatusValues)[number]) : null;
  const sort: StudentSortColumn = resolveSortColumn(sp.sort, STUDENT_SORT_COLUMNS, "created_at");

  const result = await listStudents({ page, pageSize, query, status, sort, ascending: false });

  return (
    <div>
      <AdminPageHeader
        title="Students"
        description="Business records for enrolled and prospective students. Search by code, name, email, phone, or FIDE ID."
        action={{ href: "/admin/students/new", label: "Add student" }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/students/import"
          className="rounded-md border border-border-strong px-3 py-1.5 text-body-sm text-foreground hover:border-primary hover:text-primary-text"
        >
          Bulk import
        </Link>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-body-sm font-medium text-foreground">
            Search
          </label>
          <input id="q" name="q" defaultValue={query ?? ""} placeholder="Name, code, email, phone, FIDE ID" className={`${inputClasses} w-64`} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-body-sm font-medium text-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">All statuses</option>
            {studentStatusValues.map((value) => (
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
        <p className="mt-8 text-body-sm text-muted-foreground">No students match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Student code</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Level</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Joined</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.student_code}</td>
                    <td className="px-4 py-3 text-foreground">{row.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.current_level ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} tone={toneForStatus("student", row.status)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.joined_on ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/students/${row.id}`} className="text-primary-text hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={result.data.totalCount}
            basePath="/admin/students"
            searchParams={{ q: query ?? undefined, status: status ?? undefined }}
          />
        </>
      )}
    </div>
  );
}
