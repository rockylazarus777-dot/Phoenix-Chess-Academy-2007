import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentAchievement } from "@/lib/queries/parent/achievements";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Achievement Detail",
  description: "Details for one of a linked student's Phoenix Chess Academy achievements.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/achievements/[achievementId]` — every
 * request re-verifies the parent/student relationship via
 * `getLinkedStudent()` first, then `getParentStudentAchievement()`
 * independently re-verifies `parent_has_student()` inside the RPC
 * (defense in depth), and additionally requires status IN
 * ('PUBLISHED','ARCHIVED'). Read-only. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Achievement
 * Routes".
 */
export default async function ParentStudentAchievementDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; achievementId: string }>;
}) {
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

  const { studentId, achievementId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await getParentStudentAchievement(student.id, achievementId);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const achievement = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{achievement.title}</h1>
          <AchievementStatusBadge status={achievement.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {student.fullName} · {achievementTypeLabel(achievement.achievement_type)}
          {achievement.tournament_name ? ` · ${achievement.tournament_name}` : ""}
        </p>
        {achievement.achievement_date ? <p className="mt-1 text-body-sm text-muted-foreground">{achievement.achievement_date}</p> : null}
      </div>

      {achievement.description ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Description</h2>
          <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{achievement.description}</p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {achievement.program_name ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Program</dt>
              <dd className="text-body-sm text-foreground">{achievement.program_name}</dd>
            </div>
          ) : null}
          {achievement.placement != null ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Placement</dt>
              <dd className="text-body-sm text-foreground">{achievement.placement}</dd>
            </div>
          ) : null}
          {achievement.external_organization ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">External organization</dt>
              <dd className="text-body-sm text-foreground">{achievement.external_organization}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
