import { siteConfig } from "@/config/site";

export type ParentPortalStateCode =
  | "DATABASE_UNAVAILABLE"
  | "PARENT_NOT_LINKED"
  | "ACCOUNT_RESTRICTED"
  | "NO_STUDENTS"
  | "NO_PROGRAMS"
  | "NO_BATCHES"
  | "NO_SCHEDULE"
  | "NO_ATTENDANCE"
  | "NO_PROGRESS"
  | "NO_ASSIGNMENTS"
  | "NO_CERTIFICATES"
  | "NO_ACHIEVEMENTS"
  | "UNKNOWN";

const COPY: Record<ParentPortalStateCode, { title: string; body: string }> = {
  DATABASE_UNAVAILABLE: {
    title: "Portal temporarily unavailable",
    body: "We can't reach the academy's systems right now. Please try again shortly.",
  },
  PARENT_NOT_LINKED: {
    title: "Parent record not linked",
    body: `Your Phoenix parent account is signed in, but the parent record is not currently linked. Please contact Phoenix Chess Academy for assistance at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  ACCOUNT_RESTRICTED: {
    title: "Portal access is currently limited",
    body: `Your parent account currently has limited portal access. If you believe this is unexpected, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_STUDENTS: {
    title: "No students are currently linked to your parent account",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_PROGRAMS: {
    title: "No program enrollment is currently linked to this student record",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_BATCHES: {
    title: "No batch assignment is currently linked to this student record",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_SCHEDULE: {
    title: "No recurring class schedule is available yet",
    body: "Once this student is assigned to a batch with a defined weekly schedule, it will appear here.",
  },
  NO_ATTENDANCE: {
    title: "No class sessions are currently available in this student's attendance history",
    body: "Once a class session is recorded for this student's batch, it will appear here.",
  },
  NO_PROGRESS: {
    title: "No published progress evaluations are currently available for this student",
    body: "Once this student's coach publishes a progress evaluation, it will appear here.",
  },
  NO_ASSIGNMENTS: {
    title: "No assignments are currently available for this student",
    body: "Once this student's coach publishes an assignment, it will appear here.",
  },
  NO_CERTIFICATES: {
    title: "No certificates are currently available for this student",
    body: "Once Phoenix Chess Academy issues this student a certificate, it will appear here.",
  },
  NO_ACHIEVEMENTS: {
    title: "No achievements are currently available for this student",
    body: "Once Phoenix Chess Academy publishes an achievement for this student, it will appear here.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    body: "Please try again. If this continues, contact the academy for help.",
  },
};

/**
 * Every /parent error/empty state renders through this one component —
 * never a raw Supabase error, never an internal error code, never a
 * `profile_id`/UUID/table name. Deliberately NOT the student-specific
 * `StudentPortalState` (different wording, different code union — a
 * parent's "not linked" message must never say "student record"). See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Error States".
 */
export function ParentPortalState({ code }: { code: ParentPortalStateCode }) {
  const copy = COPY[code];

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-body font-medium text-foreground">{copy.title}</p>
      <p className="mt-2 text-body-sm text-muted-foreground">{copy.body}</p>
    </div>
  );
}
