import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentAchievements } from "@/lib/queries/student/achievements";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Achievements",
  description: "Your Phoenix Chess Academy achievements.",
  path: "/portal/achievements",
  index: false,
});

/**
 * `/portal/achievements` — every row comes from `get_student_achievements()`,
 * returning only PUBLISHED/ARCHIVED achievements for the current student.
 * DRAFT never appears. No fabricated badges, no ranking calculation. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Achievement
 * Routes".
 */
export default async function StudentAchievementsPage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return (
      <StudentPortalState
        code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getStudentAchievements();
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Achievements</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Verified achievements recognized by Phoenix Chess Academy.</p>
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_ACHIEVEMENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.achievement_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/portal/achievements/${row.achievement_id}`} className="text-body font-medium text-primary-text hover:underline">
                  {row.title}
                </Link>
                <AchievementStatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {achievementTypeLabel(row.achievement_type)}
                {row.tournament_name ? ` · ${row.tournament_name}` : ""}
                {row.placement != null ? ` · Placement: ${row.placement}` : ""}
              </p>
              {row.achievement_date ? <p className="mt-1 text-body-sm text-muted-foreground">{row.achievement_date}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
