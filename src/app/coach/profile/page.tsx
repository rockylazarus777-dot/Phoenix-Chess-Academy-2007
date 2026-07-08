import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getCoachProfile } from "@/lib/queries/coach/profile";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { CoachStatusBadge, coachStatusTone } from "@/components/portal/coach/CoachStatusBadge";

export const metadata = buildMetadata({
  title: "My Profile",
  description: "Your Phoenix Chess Academy coach profile.",
  path: "/coach/profile",
  index: false,
});

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-body-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Read-only profile — no Edit Profile action exists in Phase 13. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Profile Privacy".
 */
export default async function CoachProfilePage() {
  const identity = await getCurrentCoach();

  if (identity.status !== "OK") {
    return (
      <CoachPortalState
        code={identity.status === "NOT_LINKED" ? "COACH_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <CoachPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getCoachProfile(identity.coach.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  const profile = result.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h4 text-foreground">My Profile</h1>
        <CoachStatusBadge label={profile.status} tone={coachStatusTone(profile.status)} />
      </div>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Coach Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Coach code" value={profile.coachCode} />
          <Field label="Full name" value={profile.fullName} />
        </dl>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Professional Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Bio" value={profile.bio} />
          <Field label="Specializations" value={profile.specializations.length > 0 ? profile.specializations.join(", ") : null} />
        </dl>
        {!profile.bio && profile.specializations.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No professional information is configured yet.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Contact Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="WhatsApp" value={profile.whatsapp} />
        </dl>
        {!profile.email && !profile.phone && !profile.whatsapp ? (
          <p className="text-body-sm text-muted-foreground">No contact information is configured yet.</p>
        ) : null}
      </section>

      <p className="text-body-sm text-muted-foreground">
        Need to update any of this information? Contact Phoenix Chess Academy at {siteConfig.contact.email} or{" "}
        {siteConfig.contact.phone}.
      </p>
    </div>
  );
}
