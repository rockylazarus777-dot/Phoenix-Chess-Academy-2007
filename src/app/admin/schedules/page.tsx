import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listSchedules } from "@/lib/queries/admin/schedules";
import { parsePaginationParams } from "@/lib/admin/pagination";
import { weekdayValues } from "@/lib/validation/admin/schedule";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { ScheduleActiveToggle } from "@/components/admin/schedules/ScheduleActiveToggle";
import { selectClasses } from "@/components/admin/forms/FormField";
import type { Weekday } from "@/lib/supabase/types";

export const metadata = buildMetadata({ title: "Schedules", description: "Recurring class schedule definitions.", path: "/admin/schedules", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; day?: string; active?: string }>;
}

export default async function AdminSchedulesPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_SCHEDULES");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const dayOfWeek = (weekdayValues as readonly string[]).includes(sp.day ?? "") ? (sp.day as Weekday) : null;
  const activeOnly = sp.active === "true";

  const result = await listSchedules({ page, pageSize, batchId: null, dayOfWeek, activeOnly });

  return (
    <div>
      <AdminPageHeader
        title="Schedules"
        description="Recurring weekly class time definitions — not attendance. Attendance attaches to dated sessions, a future phase."
        action={{ href: "/admin/schedules/new", label: "Add schedule" }}
      />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="day" className="text-body-sm font-medium text-foreground">
            Day
          </label>
          <select id="day" name="day" defaultValue={dayOfWeek ?? ""} className={selectClasses}>
            <option value="">All days</option>
            {weekdayValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-body-sm text-foreground">
          <input type="checkbox" name="active" value="true" defaultChecked={activeOnly} /> Active only
        </label>
        <button type="submit" className="h-11 rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground hover:opacity-90">
          Apply
        </button>
      </form>

      {!result.ok ? (
        <AdminQueryError code={result.code} />
      ) : result.data.rows.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">No schedules match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Batch</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Day</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Active</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{row.batch_name} ({row.batch_code})</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.day_of_week}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.start_time}–{row.end_time}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.active ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-right">
                      <ScheduleActiveToggle scheduleId={row.id} batchId={row.batch_id} active={row.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={pageSize} totalCount={result.data.totalCount} basePath="/admin/schedules" searchParams={{ day: dayOfWeek ?? undefined, active: activeOnly ? "true" : undefined }} />
        </>
      )}
    </div>
  );
}
