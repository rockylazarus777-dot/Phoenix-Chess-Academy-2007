import { buildMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/requireRole";
import { PORTAL_ALLOWED_ROLES } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";
import { StatCard } from "@/components/admin/StatCard";
import { countStudents } from "@/lib/queries/admin/students";
import { countParents } from "@/lib/queries/admin/parents";
import { countCoaches } from "@/lib/queries/admin/coaches";
import { countActiveBatches } from "@/lib/queries/admin/batches";
import { countActiveEnrollments } from "@/lib/queries/admin/enrollments";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

export const metadata = buildMetadata({
  title: "Administration",
  description: "Phoenix Chess Academy administration.",
  path: "/admin",
  index: false,
});

/**
 * Admin operations overview. Every number here is a real, live count —
 * there is no hardcoded "5,247 active students" placeholder anywhere in
 * this file. Each card is only fetched (and only shown) if the signed-in
 * role has the matching VIEW_* permission; a STAFF user who cannot view
 * coaches simply doesn't see a Coaches card, rather than seeing a
 * blanked-out one. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Admin Home (/admin)".
 */
export default async function AdminPage() {
  const profile = await requireRole(PORTAL_ALLOWED_ROLES.admin);
  const configured = isAdminSupabaseConfigured();

  const [students, parents, coaches, batches, enrollments] = await Promise.all([
    hasPermission(profile.role, "VIEW_STUDENTS") ? countStudents() : Promise.resolve(null),
    hasPermission(profile.role, "VIEW_PARENTS") ? countParents() : Promise.resolve(null),
    hasPermission(profile.role, "VIEW_COACHES") ? countCoaches() : Promise.resolve(null),
    hasPermission(profile.role, "VIEW_BATCHES") ? countActiveBatches() : Promise.resolve(null),
    hasPermission(profile.role, "VIEW_ENROLLMENTS") ? countActiveEnrollments() : Promise.resolve(null),
  ]);

  return (
    <div>
      <p className="text-h4 text-foreground">Administration overview</p>
      <p className="mt-2 text-body-sm text-muted-foreground">
        Signed in as {profile.fullName ?? profile.email ?? "—"} ({profile.role}).
      </p>

      {!configured ? (
        <div className="mt-6 rounded-lg border border-warning/40 bg-surface p-4 text-body-sm text-foreground">
          The admin database is not configured in this environment. Record counts and management actions are
          unavailable until Supabase credentials are set.
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {students ? <StatCard label="Students" href="/admin/students" result={students} /> : null}
        {parents ? <StatCard label="Parents" href="/admin/parents" result={parents} /> : null}
        {coaches ? <StatCard label="Coaches" href="/admin/coaches" result={coaches} /> : null}
        {batches ? <StatCard label="Active batches" href="/admin/batches" result={batches} /> : null}
        {enrollments ? <StatCard label="Active enrollments" href="/admin/enrollments" result={enrollments} /> : null}
      </div>

      <p className="mt-8 text-body-sm text-muted-foreground">
        Attendance, progress tracking, certificates, payments, and analytics are not part of this phase.
      </p>
    </div>
  );
}
