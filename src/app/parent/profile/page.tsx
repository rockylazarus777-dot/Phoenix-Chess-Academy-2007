import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getParentProfile } from "@/lib/queries/parent/profile";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { ParentStatusBadge, parentStatusTone } from "@/components/portal/parent/ParentStatusBadge";

export const metadata = buildMetadata({
  title: "My Profile",
  description: "Your Phoenix Chess Academy parent profile.",
  path: "/parent/profile",
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
 * Read-only profile — no edit form exists in Phase 12. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Profile Privacy".
 */
export default async function ParentProfilePage() {
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

  const result = await getParentProfile(identity.parent.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const profile = result.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h4 text-foreground">My Profile</h1>
        <ParentStatusBadge label={profile.status} tone={parentStatusTone(profile.status)} />
      </div>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Parent Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" value={profile.fullName} />
        </dl>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Contact Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="WhatsApp" value={profile.whatsapp} />
        </dl>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Location</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Country" value={profile.country} />
          <Field label="State" value={profile.state} />
          <Field label="City" value={profile.city} />
        </dl>
      </section>

      <p className="text-body-sm text-muted-foreground">
        Need to update any of this information? Contact Phoenix Chess Academy at {siteConfig.contact.email} or{" "}
        {siteConfig.contact.phone}.
      </p>
    </div>
  );
}
