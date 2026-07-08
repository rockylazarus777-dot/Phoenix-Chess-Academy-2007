import { z } from "zod";

/**
 * Mirrors `public.assignment_audience_type` exactly (Phase 16). Only BATCH
 * and STUDENT — never ACADEMY/PUBLIC/PROGRAM/LOCATION/CUSTOM_GROUP. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Audience Architecture".
 */
export const assignmentAudienceValues = ["BATCH", "STUDENT"] as const;

/**
 * Mirrors `public.assignment_submission_status` exactly. A coach may only
 * ever submit REVIEWED or REVISION_REQUESTED through the review form —
 * SUBMITTED is a student-only initial/resubmission state and is never a
 * selectable review outcome.
 */
export const coachReviewStatusValues = ["REVIEWED", "REVISION_REQUESTED"] as const;

const isoDateTimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Shared title/description/instructions field rules — matches the database
 * check constraints in 0023_assignments_submissions.sql exactly (client-side
 * validation is a usability convenience; the database constraint remains
 * the authoritative backstop). See docs/ASSIGNMENTS_ARCHITECTURE.md,
 * "Assignment Text Limits".
 */
const assignmentContentFields = {
  title: z.string().trim().min(1, "Enter an assignment title.").max(200, "Title must be 200 characters or fewer."),
  description: z.string().trim().min(1, "Enter an assignment description.").max(3000, "Description must be 3000 characters or fewer."),
  instructions: z.string().trim().max(5000, "Instructions must be 5000 characters or fewer.").optional().or(z.literal("")),
  dueAt: z
    .string()
    .trim()
    .regex(isoDateTimeLocalRegex, "Enter a valid due date and time.")
    .optional()
    .or(z.literal("")),
  allowLateSubmission: z.boolean(),
};

/**
 * Coach-submitted new-assignment form. `batchId` must already have passed
 * `getAssignedBatch()` authorization at the page level — this schema only
 * validates shape, never authorizes by itself. For STUDENT audience,
 * `studentId` is validated as a UUID here but `create_assignment()`
 * independently re-verifies the student/batch relationship server-side via
 * `student_in_batch_roster()`. `programId`/`sessionId` are optional — the
 * server always derives program context from the batch's own program_id
 * regardless of what (if anything) is submitted here. `coachId`/`createdBy`
 * are never fields on this schema. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Create Assignment RPC".
 */
export const createAssignmentSchema = z
  .object({
    batchId: z.string().uuid("Select a batch."),
    audienceType: z.enum(assignmentAudienceValues),
    studentId: z.string().uuid().optional().or(z.literal("")),
    programId: z.string().uuid().optional().or(z.literal("")),
    sessionId: z.string().uuid().optional().or(z.literal("")),
    ...assignmentContentFields,
  })
  .refine((values) => values.audienceType !== "STUDENT" || Boolean(values.studentId), {
    message: "Select a student for a direct student assignment.",
    path: ["studentId"],
  })
  .refine((values) => values.audienceType !== "BATCH" || !values.studentId, {
    message: "A batch assignment must not select an individual student.",
    path: ["studentId"],
  });

export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

/**
 * Coach-submitted edit form for an existing DRAFT assignment.
 * `assignmentId` is a route/resource identifier only — the server
 * independently re-verifies ownership, status (DRAFT), and current batch
 * assignment before applying any change. `audienceType`/`batchId`/
 * `studentId` are deliberately absent — they can never be changed by this
 * form (see "Update Assignment RPC": archive and recreate instead).
 */
export const updateAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  programId: z.string().uuid().optional().or(z.literal("")),
  sessionId: z.string().uuid().optional().or(z.literal("")),
  ...assignmentContentFields,
});

export type UpdateAssignmentValues = z.infer<typeof updateAssignmentSchema>;

/**
 * Student-submitted submission form. At least one of submissionText /
 * submissionUrl is required (matches the database's
 * assignment_submissions_content_required_check). submissionUrl is
 * restricted to http(s) only — javascript:/data:/file:/ftp: are rejected
 * here AND again by the database check constraint AND again inside
 * `submit_assignment()`. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Submission
 * URL Security".
 */
export const submitAssignmentSchema = z
  .object({
    assignmentId: z.string().uuid(),
    submissionText: z.string().trim().max(5000, "Submission text must be 5000 characters or fewer.").optional().or(z.literal("")),
    submissionUrl: z
      .string()
      .trim()
      .max(2048, "Link must be 2048 characters or fewer.")
      .refine((value) => value.length === 0 || /^https?:\/\//i.test(value), {
        message: "Enter a valid http:// or https:// link.",
      })
      .optional()
      .or(z.literal("")),
  })
  .refine((values) => Boolean(values.submissionText?.trim()) || Boolean(values.submissionUrl?.trim()), {
    message: "Add submission text or a link before submitting.",
    path: ["submissionText"],
  });

export type SubmitAssignmentValues = z.infer<typeof submitAssignmentSchema>;

/**
 * Coach-submitted review form. REVISION_REQUESTED requires non-empty
 * feedback (matches assignment_submissions_revision_feedback_check);
 * REVIEWED permits optional feedback. `reviewedBy`/`reviewedAt` are never
 * fields on this schema — the server always derives both.
 */
export const reviewSubmissionSchema = z
  .object({
    submissionId: z.string().uuid(),
    status: z.enum(coachReviewStatusValues),
    feedback: z.string().trim().max(3000, "Feedback must be 3000 characters or fewer.").optional().or(z.literal("")),
  })
  .refine((values) => values.status !== "REVISION_REQUESTED" || Boolean(values.feedback?.trim()), {
    message: "Add feedback explaining what needs revision.",
    path: ["feedback"],
  });

export type ReviewSubmissionValues = z.infer<typeof reviewSubmissionSchema>;
