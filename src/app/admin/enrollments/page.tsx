import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listEnrollments } from "@/lib/queries/admin/enrollments";
import { parsePaginationParams } from "@/lib/admin/pagination";
import { enrollmentStatusValues } from "@/lib/validation/admin/enrollment";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { EnrollmentStatusSelect } from "@/components/admin/enrollments/EnrollmentStatusSelect";
import { selectClasses } from "@/components/admin/forms/FormField";
import type { EnrollmentStatus } from "@/lib/supabase/types";

export const metadata = buildMetadata({ title: "Enrollments", description: "Program enrollments and batch assignments.", path: "/admin/enrollments", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; studentId?: string; status?: string }>;
}

export default async function AdminEnrollmentsPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_ENROLLMENTS");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const studentId = sp.studentId && isUuid(sp.studentId) ? sp.studentId : null;
  const status = (enrollmentStatusValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as EnrollmentStatus) : null;

  const result = await listEnrollments({ page, pageSize, studentId, programId: null, batchId: null, status });

  return (
    <div>
      <AdminPageHeader
        title="Enrollments"
        description="Program enrollments and batch assignments — not billing or payment status."
        action={{ href: "/admin/enrollments/new", label: "Add enrollment" }}
      />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-body-sm font-medium text-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">All statuses</option>
            {enrollmentStatusValues.map((value) => (
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
        <p className="mt-8 text-body-sm text-muted-foreground">No enrollments match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Program</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Batch</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Enrolled</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{row.student_name} ({row.student_code})</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.program_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.batch_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.enrolled_on}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={row.status} tone={toneForStatus("enrollment", row.status)} />
                        <EnrollmentStatusSelect enrollmentId={row.id} studentId={row.student_id} currentStatus={row.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} totalCount={result.data.totalCount} basePath="/admin/enrollments" searchParams={{ status: status ?? undefined }} />
        </>
      )}
    </div>
  );
}
