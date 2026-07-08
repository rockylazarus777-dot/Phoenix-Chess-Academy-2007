import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentAchievements } from "@/lib/queries/parent/achievements";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Student Achievements",
  description: "Achievements for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/achievements` — every request re-verifies
 * the parent/student relationship via `getLinkedStudent()` first, then
 * queries achievements through `listParentStudentAchievements()`, a
 * second, independent authorization layer. Read-only. No mutation, no
 * other student data, no fabricated badges. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Achievement
 * Routes".
 */
export default async function ParentStudentAchievementsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const identity = await getCurrentParent();

  if (identity.status !== "OK") {
    return (
      <ParentPortalState
        code={identity.status === "NOT_LINKED" ? "PARENT_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <ParentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { studentId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await listParentStudentAchievements(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Achievements</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Verified achievements recognized by Phoenix Chess Academy.</p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_ACHIEVEMENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.achievement_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/parent/students/${student.id}/achievements/${row.achievement_id}`}
                  className="text-body font-medium text-primary-text hover:underline"
                >
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
