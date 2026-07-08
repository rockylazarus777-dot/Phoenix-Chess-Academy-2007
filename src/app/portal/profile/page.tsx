import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentProfile } from "@/lib/queries/student/profile";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { StudentStatusBadge, studentStatusTone } from "@/components/portal/student/StudentStatusBadge";

export const metadata = buildMetadata({
  title: "My Profile",
  description: "Your Phoenix Chess Academy student profile.",
  path: "/portal/profile",
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
 * Read-only profile — no edit form exists in Phase 11. Date of birth
 * appears here only (never in the shell, dashboard, or any URL) since
 * this is the student viewing their own record. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student PII Exposure Rules".
 */
export default async function StudentProfilePage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getStudentProfile(identity.student.id);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const profile = result.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h4 text-foreground">My Profile</h1>
        <StudentStatusBadge label={profile.status} tone={studentStatusTone(profile.status)} />
      </div>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Student Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Student code" value={profile.studentCode} />
          <Field label="Full name" value={profile.fullName} />
          <Field label="Date of birth" value={profile.dateOfBirth} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Current level" value={profile.currentLevel} />
          <Field label="Joined on" value={profile.joinedOn} />
        </dl>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="mb-4 text-body font-medium text-foreground">Chess Information</h2>
        {!profile.fideId && !profile.fideRating && !profile.chessAssociationId ? (
          <p className="text-body-sm text-muted-foreground">No chess federation details are on file yet.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="FIDE ID" value={profile.fideId} />
            <Field label="FIDE rating" value={profile.fideRating != null ? String(profile.fideRating) : null} />
            <Field label="Chess association ID" value={profile.chessAssociationId} />
          </dl>
        )}
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
