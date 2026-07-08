import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listAuditLog } from "@/lib/queries/admin/auditLog";
import { parsePaginationParams } from "@/lib/admin/pagination";
import { ADMIN_AUDIT_ACTIONS, ADMIN_AUDIT_ENTITY_TYPES } from "@/lib/validation/admin/auditLog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import type { AdminAuditAction } from "@/lib/supabase/types";

export const metadata = buildMetadata({ title: "Audit Log", description: "Admin operations audit log.", path: "/admin/audit-log", index: false });

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; action?: string; entityType?: string; from?: string; to?: string }>;
}

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  await requirePermission("VIEW_AUDIT_LOG");
  const sp = await searchParams;

  const { page, pageSize } = parsePaginationParams(sp);
  const action = (ADMIN_AUDIT_ACTIONS as readonly string[]).includes(sp.action ?? "") ? (sp.action as AdminAuditAction) : null;
  const entityType = (ADMIN_AUDIT_ENTITY_TYPES as readonly string[]).includes(sp.entityType ?? "") ? sp.entityType! : null;
  const fromDate = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null;
  const toDate = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null;

  const result = await listAuditLog({ page, pageSize, action, entityType, fromDate, toDate });

  return (
    <div>
      <AdminPageHeader title="Audit log" description="Operational record of admin actions. Summaries only — no raw metadata or PII is shown here." />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="action" className="text-body-sm font-medium text-foreground">
            Action
          </label>
          <select id="action" name="action" defaultValue={action ?? ""} className={selectClasses}>
            <option value="">All actions</option>
            {ADMIN_AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="entityType" className="text-body-sm font-medium text-foreground">
            Entity type
          </label>
          <select id="entityType" name="entityType" defaultValue={entityType ?? ""} className={selectClasses}>
            <option value="">All entity types</option>
            {ADMIN_AUDIT_ENTITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-body-sm font-medium text-foreground">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={fromDate ?? ""} className={inputClasses} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-body-sm font-medium text-foreground">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={toDate ?? ""} className={inputClasses} />
        </div>
        <button type="submit" className="h-11 rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground hover:opacity-90">
          Apply
        </button>
      </form>

      {!result.ok ? (
        <AdminQueryError code={result.code} />
      ) : result.data.rows.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">No audit events match these filters.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Actor role</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Entity type</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Summary</th>
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.actor_role}</td>
                    <td className="px-4 py-3 text-foreground">{row.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.entity_type}</td>
                    <td className="px-4 py-3 text-foreground">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={result.data.totalCount}
            basePath="/admin/audit-log"
            searchParams={{ action: action ?? undefined, entityType: entityType ?? undefined, from: fromDate ?? undefined, to: toDate ?? undefined }}
          />
        </>
      )}
    </div>
  );
}
