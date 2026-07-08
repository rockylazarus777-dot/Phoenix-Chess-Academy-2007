import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminAchievement } from "@/lib/queries/admin/achievements";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { AchievementStatusBadge } from "@/components/certificates/AchievementStatusBadge";
import { achievementTypeLabel } from "@/components/certificates/labels";
import { AchievementForm } from "@/components/admin/achievements/AchievementForm";
import { AchievementLifecycleControls } from "@/components/admin/achievements/AchievementLifecycleControls";

export const metadata = buildMetadata({ title: "Achievement", description: "Achievement record detail.", path: "/admin/achievements", index: false });

/**
 * `/admin/achievements/[achievementId]` — DRAFT shows Edit + Publish +
 * Archive; PUBLISHED shows Archive; ARCHIVED is read-only. Never exposes
 * created_by/published_by UUIDs or student contact PII. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Achievement
 * Detail".
 */
export default async function AdminAchievementDetailPage({ params }: { params: Promise<{ achievementId: string }> }) {
  await requirePermission("VIEW_ACHIEVEMENTS");
  const { achievementId } = await params;
  if (!isUuid(achievementId)) notFound();

  const result = await getAdminAchievement(achievementId);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const achievement = result.data;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={achievement.title}
        description={`${achievement.student_name} (${achievement.student_code}) · ${achievementTypeLabel(achievement.achievement_type)}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <AchievementStatusBadge status={achievement.status} />
      </div>

      <section className="rounded-lg border border-border p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Achievement date</dt>
            <dd className="text-body-sm text-foreground">{achievement.achievement_date ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Program</dt>
            <dd className="text-body-sm text-foreground">{achievement.program_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Tournament</dt>
            <dd className="text-body-sm text-foreground">{achievement.tournament_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Placement</dt>
            <dd className="text-body-sm text-foreground">{achievement.placement ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">External organization</dt>
            <dd className="text-body-sm text-foreground">{achievement.external_organization ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Published</dt>
            <dd className="text-body-sm text-foreground">{achievement.published_at ?? "—"}</dd>
          </div>
        </dl>
        {achievement.description ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-foreground">{achievement.description}</p>
          </div>
        ) : null}
      </section>

      <AchievementLifecycleControls achievementId={achievement.achievement_id} status={achievement.status} />

      {achievement.status === "DRAFT" ? (
        <section>
          <h2 className="mb-3 text-body font-medium text-foreground">Edit achievement</h2>
          <AchievementForm
            mode="edit"
            achievementId={achievement.achievement_id}
            student={{ id: achievement.student_id, fullName: achievement.student_name, studentCode: achievement.student_code }}
            initialValues={{
              achievementType: achievement.achievement_type,
              title: achievement.title,
              description: achievement.description ?? "",
              achievementDate: achievement.achievement_date ?? "",
              programId: achievement.program_id ?? "",
              tournamentId: achievement.tournament_id ?? "",
              placement: achievement.placement != null ? String(achievement.placement) : "",
              externalOrganization: achievement.external_organization ?? "",
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
