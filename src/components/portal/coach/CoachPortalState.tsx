import { siteConfig } from "@/config/site";

export type CoachPortalStateCode =
  | "DATABASE_UNAVAILABLE"
  | "COACH_NOT_LINKED"
  | "ACCOUNT_RESTRICTED"
  | "NO_BATCHES"
  | "NO_STUDENTS"
  | "NO_SCHEDULE"
  | "NO_SESSIONS"
  | "SESSION_CANCELLED"
  | "NO_PROGRESS"
  | "EVALUATION_NOT_EDITABLE"
  | "EMPTY_EVALUATION"
  | "NO_ASSIGNMENTS"
  | "NO_SUBMISSIONS"
  | "VALIDATION_ERROR"
  | "INVALID_TRANSITION"
  | "UNKNOWN";

const COPY: Record<CoachPortalStateCode, { title: string; body: string }> = {
  DATABASE_UNAVAILABLE: {
    title: "Portal temporarily unavailable",
    body: "We can't reach the academy's systems right now. Please try again shortly.",
  },
  COACH_NOT_LINKED: {
    title: "Coach record not linked",
    body: `Your Phoenix coach account is signed in, but the coach record is not currently linked. Please contact Phoenix Chess Academy for assistance at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  ACCOUNT_RESTRICTED: {
    title: "Portal access is currently limited",
    body: `Your coach account currently has limited portal access. If you believe this is unexpected, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_BATCHES: {
    title: "No batches are currently assigned to your coach account",
    body: `If you believe this is incorrect, please contact Phoenix Chess Academy at ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
  },
  NO_STUDENTS: {
    title: "No students are currently linked to this batch",
    body: "This roster will update once students are enrolled or assigned to this batch.",
  },
  NO_SCHEDULE: {
    title: "No recurring class schedule is available yet",
    body: "Once this batch has a defined weekly schedule, it will appear here.",
  },
  NO_SESSIONS: {
    title: "No class sessions exist yet for your assigned batches",
    body: "Once a class session is created for one of your batches, it will appear here.",
  },
  SESSION_CANCELLED: {
    title: "This session has been cancelled",
    body: "Cancelled sessions cannot receive or update attendance records.",
  },
  NO_PROGRESS: {
    title: "No student progress evaluations are currently available",
    body: "Once you create an evaluation for one of your assigned batches, it will appear here.",
  },
  EVALUATION_NOT_EDITABLE: {
    title: "This evaluation can no longer be edited",
    body: "Only a DRAFT evaluation you authored, for a batch you currently manage, can be edited.",
  },
  EMPTY_EVALUATION: {
    title: "Add content before publishing",
    body: "Add an overall summary and at least one development area rating before publishing this evaluation.",
  },
  NO_ASSIGNMENTS: {
    title: "No assignments are currently available",
    body: "Once you create an assignment for one of your assigned batches, it will appear here.",
  },
  NO_SUBMISSIONS: {
    title: "No student submissions are currently available for this assignment",
    body: "Once a student submits work for this assignment, it will appear here.",
  },
  VALIDATION_ERROR: {
    title: "Please check the form and try again",
    body: "One or more fields could not be saved. Review the form and resubmit.",
  },
  INVALID_TRANSITION: {
    title: "That status change isn't allowed",
    body: "This session's current status doesn't allow the requested change.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    body: "Please try again. If this continues, contact the academy for help.",
  },
};

/**
 * Every /coach error/empty state renders through this one component —
 * never a raw Supabase error, never an internal error code, never a
 * `profile_id`/UUID/table name. Deliberately NOT the Student or Parent
 * Portal's state components — a coach's "not linked" message says
 * "coach record," never "student record" or "parent record." See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Error States".
 */
export function CoachPortalState({ code }: { code: CoachPortalStateCode }) {
  const copy = COPY[code];

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <p className="text-body font-medium text-foreground">{copy.title}</p>
      <p className="mt-2 text-body-sm text-muted-foreground">{copy.body}</p>
    </div>
  );
}
