import { siteConfig } from "@/config/site";

export type StudentPortalStateCode =
  | "DATABASE_UNAVAILABLE"
  | "NOT_LINKED"
  | "ACCOUNT_RESTRICTED"
  | "UNKNOWN"
  | "NO_PROGRAMS"
  | "NO_BATCHES"
  | "NO_SCHEDULE"
  | "NO_ATTENDANCE"
  | "NO_PROGRESS"
  | "NO_ASSIGNMENTS"
  | "NO_CERTIFICATES"
  | "NO_ACHIEVEMENTS";

const COPY: Record<StudentPortalStateCode, { title: string; body: string }> = {
  DATABASE_UNAVAILABLE: {
    title: "Portal temporarily unavailable",
    body: "We can't reach the academy's systems right now. Please try again shortly.",
  },
  NOT_LINKED: {
    title: "Student record not linked",
    body: `Your Phoenix student account is signed in, but the student record is not currently linked. Please contact Phoenix Chess Academy for assistance at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  ACCOUNT_RESTRICTED: {
    title: "Portal access is currently limited",
    body: `Your student account currently has limited portal access. If you believe this is unexpected, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  UNKNOWN: {
    title: "Something went wrong",
    body: "Please try again. If this continues, contact the academy for help.",
  },
  NO_PROGRAMS: {
    title: "No program enrollment is currently linked to your student record",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_BATCHES: {
    title: "No batch assignment is currently linked to your student record",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_SCHEDULE: {
    title: "No recurring class schedule is available yet",
    body: "Once you're assigned to a batch with a defined weekly schedule, it will appear here.",
  },
  NO_ATTENDANCE: {
    title: "No class sessions are currently available in your attendance history",
    body: "Once a class session is recorded for your batch, it will appear here.",
  },
  NO_PROGRESS: {
    title: "No published progress evaluations are currently available",
    body: "Once your coach publishes a progress evaluation, it will appear here.",
  },
  NO_ASSIGNMENTS: {
    title: "No assignments are currently available",
    body: "Once your coach publishes an assignment for your batch, it will appear here.",
  },
  NO_CERTIFICATES: {
    title: "No certificates are currently available",
    body: "Once Phoenix Chess Academy issues you a certificate, it will appear here.",
  },
  NO_ACHIEVEMENTS: {
    title: "No achievements are currently available",
    body: "Once Phoenix Chess Academy publishes an achievement for you, it will appear here.",
  },
};

/**
 * Every /portal error/empty state renders through this one component —
 * never a raw Supabase error, never an internal error code, never a
 * `profile_id`/UUID/table name. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student Error States".
 */
export function StudentPortalState({ code }: { code: StudentPortalStateCode }) {
  const copy = COPY[code];

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-body font-medium text-foreground">{copy.title}</p>
      <p className="mt-2 text-body-sm text-muted-foreground">{copy.body}</p>
    </div>
  );
}
