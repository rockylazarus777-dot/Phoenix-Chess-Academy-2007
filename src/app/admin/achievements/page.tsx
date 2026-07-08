import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listAdminAchievements } from "@/lib/queries/admin/achievements";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";
import type { AchievementStatus } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Achievements",
  description: "Verified student achievement records.",
  path: "/admin/achievements",
  index: false,
});

const GROUPS: { status: AchievementStatus; heading: string }[] = [
  { status: "DRAFT", heading: "Draft Achievements" },
  { status: "PUBLISHED", heading: "Published Achievements" },
  { status: "ARCHIVED", heading: "Archived Achievements" },
];

/**
 * `/admin/achievements` — every achievement record, grouped Draft/
 * Published/Archived. Never shows student contact PII. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Achievement
 * List".
 */
export default async function AdminAchievementsPage() {
  await requirePermission("VIEW_ACHIEVEMENTS");

  const result = await listAdminAchievements();

  return (
    <div>
      <AdminPageHeader title="Achievements" description="Verified student achievement records." action={{ href: "/admin/achievements/new", label: "Add achievement" }} />

      {!result.ok ? (
        <AdminQueryError code={result.code} />
      ) : result.data.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">No achievement records are currently available.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {GROUPS.map((group) => {
            const rows = result.data.filter((row) => row.status === group.status);
            if (rows.length === 0) return null;
            return (
              <section key={group.status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{group.heading}</h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-body-sm">
                    <thead className="border-b border-border bg-surface">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Student</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Title</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Tournament</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Placement</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.achievement_id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-foreground">
                            {row.student_name} ({row.student_code})
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{achievementTypeLabel(row.achievement_type)}</td>
                          <td className="px-4 py-3 text-foreground">{row.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.achievement_date ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.tournament_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.placement ?? "—"}</td>
                          <td className="px-4 py-3">
                            <AchievementStatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/achievements/${row.achievement_id}`} className="text-primary-text hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
