import { z } from "zod";

/**
 * Controlled, closed canonical chess development areas — mirrors
 * `public.development_area` (supabase/migrations/0021_student_progress_evaluations.sql)
 * exactly. Never accept a free-text area name from a form; only these ten
 * values are ever valid. See docs/STUDENT_PROGRESS_ARCHITECTURE.md,
 * "Development Area Architecture".
 */
export const developmentAreaValues = [
  "OPENING",
  "MIDDLEGAME",
  "ENDGAME",
  "TACTICS",
  "CALCULATION",
  "POSITIONAL_PLAY",
  "TIME_MANAGEMENT",
  "CONCENTRATION",
  "DECISION_MAKING",
  "TOURNAMENT_PREPARATION",
] as const;

export const MAX_AREA_RATINGS = 20;

/**
 * One development-area rating within an evaluation. `rating` is a 1-5
 * internal structured development scale — never a percentage/Elo-like/
 * FIDE-style score. `comment` is a short chess-development comment only
 * (never medical/financial/government-ID/credential content) — enforced
 * here and again at the database/RPC layer.
 */
export const areaRatingSchema = z.object({
  area: z.enum(developmentAreaValues),
  rating: z
    .number()
    .int("Rating must be a whole number.")
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  comment: z.string().trim().max(500, "Comment must be 500 characters or fewer.").optional().or(z.literal("")),
});

export type AreaRatingValues = z.infer<typeof areaRatingSchema>;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shared field-level rules for both create and update forms. `overall_summary`
 * <=2000, `strengths`/`development_focus`/`coach_recommendation` <=1500 each
 * — matches the database check constraints in
 * 0021_student_progress_evaluations.sql exactly (client-side validation is a
 * usability convenience; the database constraint remains the authoritative
 * backstop). At least one area rating is required even at DRAFT creation
 * (see "Development Area Form" in the architecture doc) — no empty
 * evaluation shell is ever created.
 */
const evaluationContentFields = {
  periodStart: z.string().trim().regex(isoDateRegex, "Enter a valid evaluation period start date."),
  periodEnd: z.string().trim().regex(isoDateRegex, "Enter a valid evaluation period end date."),
  summary: z.string().trim().max(2000, "Overall summary must be 2000 characters or fewer.").optional().or(z.literal("")),
  strengths: z.string().trim().max(1500, "Strengths must be 1500 characters or fewer.").optional().or(z.literal("")),
  developmentFocus: z.string().trim().max(1500, "Development focus must be 1500 characters or fewer.").optional().or(z.literal("")),
  coachRecommendation: z.string().trim().max(1500, "Coach recommendation must be 1500 characters or fewer.").optional().or(z.literal("")),
  areaRatings: z.array(areaRatingSchema).min(1, "Rate at least one development area.").max(MAX_AREA_RATINGS),
};

function noDuplicateAreas(values: { areaRatings: AreaRatingValues[] }) {
  return new Set(values.areaRatings.map((entry) => entry.area)).size === values.areaRatings.length;
}

function periodEndNotBeforeStart(values: { periodStart: string; periodEnd: string }) {
  return values.periodEnd >= values.periodStart;
}

/**
 * Coach-submitted new-evaluation form. `studentId`/`batchId`/`programId` are
 * validated as UUIDs here, but knowing a UUID never authorizes anything by
 * itself — `create_student_progress_evaluation()` re-verifies the batch
 * assignment and student/batch membership server-side AFTER this schema
 * passes. `programId` is always the assigned batch's own program id (batches
 * have a mandatory program_id in this schema) — never an independently
 * selected, potentially unrelated program. `coachId`/`createdBy` are never
 * fields on this schema — the server always derives them from
 * `getCurrentCoach()`/`auth.uid()`. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Create Evaluation RPC".
 */
export const createProgressEvaluationSchema = z
  .object({
    studentId: z.string().uuid("Select a student."),
    batchId: z.string().uuid("Select a batch."),
    programId: z.string().uuid("A program context is required."),
    ...evaluationContentFields,
  })
  .refine(periodEndNotBeforeStart, {
    message: "Evaluation period end cannot be before the start date.",
    path: ["periodEnd"],
  })
  .refine(noDuplicateAreas, {
    message: "Each development area may only be rated once.",
    path: ["areaRatings"],
  });

export type CreateProgressEvaluationValues = z.infer<typeof createProgressEvaluationSchema>;

/**
 * Coach-submitted edit form for an existing DRAFT evaluation.
 * `evaluationId` is a route/resource identifier only — the server
 * independently re-verifies ownership (`evaluation.coach_id = current
 * coach`), status (`DRAFT`), and current batch assignment before applying
 * any change. `studentId`/`batchId`/`programId` are deliberately absent —
 * they can never be changed by this form.
 */
export const updateProgressEvaluationSchema = z
  .object({
    evaluationId: z.string().uuid(),
    ...evaluationContentFields,
  })
  .refine(periodEndNotBeforeStart, {
    message: "Evaluation period end cannot be before the start date.",
    path: ["periodEnd"],
  })
  .refine(noDuplicateAreas, {
    message: "Each development area may only be rated once.",
    path: ["areaRatings"],
  });

export type UpdateProgressEvaluationValues = z.infer<typeof updateProgressEvaluationSchema>;
