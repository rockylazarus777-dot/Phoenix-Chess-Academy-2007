import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { listParentLinkedStudents } from "@/lib/queries/parent/students";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { ParentStatusBadge, linkedStudentStatusTone } from "@/components/portal/parent/ParentStatusBadge";

export const metadata = buildMetadata({
  title: "My Students",
  description: "Students linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * "My Students" — every `student_parents` relationship for the
 * authenticated parent. Supports one parent -> multiple students and
 * one student -> multiple guardians. A student is never hidden solely
 * because the parent is not the primary guardian — see
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Relationship Flag
 * Decision".
 */
export default async function ParentStudentsPage() {
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

  const result = await listParentLinkedStudents(identity.parent.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">My Students</h1>

      {result.data.length === 0 ? (
        <ParentPortalState code="NO_STUDENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((student) => (
            <li key={student.id} className="rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/parent/students/${student.id}`} className="text-body font-medium text-primary-text hover:underline">
                  {student.fullName}
                </Link>
                <ParentStatusBadge label={student.status} tone={linkedStudentStatusTone(student.status)} />
              </div>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {student.studentCode}
                {student.currentLevel ? ` · ${student.currentLevel}` : ""} · {student.relationship}
                {student.isPrimary ? " · Primary guardian" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
