import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentAchievement } from "@/lib/queries/student/achievements";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Achievement Detail",
  description: "Details for one of your Phoenix Chess Academy achievements.",
  path: "/portal/achievements",
  index: false,
});

/**
 * `/portal/achievements/[achievementId]` — authorization derives entirely
 * from `get_student_achievement()`, which requires
 * achievement.student_id = current_student_id() AND status IN
 * ('PUBLISHED','ARCHIVED'). See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Achievement
 * Routes".
 */
export default async function StudentAchievementDetailPage({ params }: { params: Promise<{ achievementId: string }> }) {
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

  const { achievementId } = await params;
  const result = await getStudentAchievement(achievementId);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
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
          {achievementTypeLabel(achievement.achievement_type)}
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
