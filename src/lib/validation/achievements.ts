import { z } from "zod";

/**
 * Mirrors `public.achievement_type` exactly (Phase 17). A closed,
 * curated set — deliberately excludes subjective labels like
 * GOOD_STUDENT/BEST_STUDENT/SMART_STUDENT/IMPROVED_STUDENT. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Achievement Type
 * Architecture".
 */
export const achievementTypeValues = [
  "TOURNAMENT_WINNER",
  "TOURNAMENT_RUNNER_UP",
  "TOURNAMENT_PLACEMENT",
  "CHESS_MILESTONE",
  "ACADEMY_RECOGNITION",
  "EXTERNAL_CHESS_ACHIEVEMENT",
] as const;

const placementTypes = ["TOURNAMENT_WINNER", "TOURNAMENT_RUNNER_UP", "TOURNAMENT_PLACEMENT"] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shared content field rules — matches the database check constraints in
 * 0025_certificates_achievements.sql exactly (client-side validation is a
 * usability convenience; the database constraint remains the
 * authoritative backstop). See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Achievement Text
 * Limits".
 */
const achievementContentFields = {
  title: z.string().trim().min(1, "Enter an achievement title.").max(200, "Title must be 200 characters or fewer."),
  description: z.string().trim().max(3000, "Description must be 3000 characters or fewer.").optional().or(z.literal("")),
  achievementDate: z.string().trim().regex(isoDateRegex, "Enter a valid date.").optional().or(z.literal("")),
  programId: z.string().uuid().optional().or(z.literal("")),
  tournamentId: z.string().uuid().optional().or(z.literal("")),
  placement: z
    .union([z.coerce.number().int(), z.literal("")])
    .optional(),
  externalOrganization: z.string().trim().max(300, "Organization name must be 300 characters or fewer.").optional().or(z.literal("")),
};

/**
 * ACHIEVEMENT PLACEMENT VALIDATION + TOURNAMENT CONTEXT VALIDATION —
 * mirrors student_achievements_placement_check and
 * student_achievements_tournament_context_check exactly:
 * TOURNAMENT_WINNER requires placement=1, TOURNAMENT_RUNNER_UP requires
 * placement=2, TOURNAMENT_PLACEMENT requires placement>=1, every other
 * type requires placement to be empty. The three placement types also
 * require a tournamentId. `create_student_achievement()`/
 * `update_student_achievement()` independently re-validate this
 * server-side — this schema is a usability convenience, never the
 * authoritative check.
 */
function withAchievementContextRefinements<
  T extends z.ZodType<{
    achievementType: (typeof achievementTypeValues)[number];
    tournamentId?: string;
    placement?: number | "";
  }>,
>(schema: T) {
  return schema
    .refine((values) => !placementTypes.includes(values.achievementType as (typeof placementTypes)[number]) || Boolean(values.tournamentId), {
      message: "Select a tournament for this achievement type.",
      path: ["tournamentId"],
    })
    .refine((values) => values.achievementType !== "TOURNAMENT_WINNER" || values.placement === 1, {
      message: "Tournament Winner requires placement 1.",
      path: ["placement"],
    })
    .refine((values) => values.achievementType !== "TOURNAMENT_RUNNER_UP" || values.placement === 2, {
      message: "Tournament Runner-Up requires placement 2.",
      path: ["placement"],
    })
    .refine((values) => values.achievementType !== "TOURNAMENT_PLACEMENT" || (typeof values.placement === "number" && values.placement >= 1), {
      message: "Tournament Placement requires a placement of 1 or greater.",
      path: ["placement"],
    })
    .refine(
      (values) =>
        placementTypes.includes(values.achievementType as (typeof placementTypes)[number]) || values.placement === "" || values.placement === undefined,
      {
        message: "Placement only applies to tournament placement achievement types.",
        path: ["placement"],
      },
    );
}

/**
 * Admin-submitted new-achievement form. `studentId` comes from the
 * narrow admin student search result, never a free-text field. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Create Achievement RPC".
 */
export const createAchievementSchema = withAchievementContextRefinements(
  z.object({
    studentId: z.string().uuid("Select a student."),
    achievementType: z.enum(achievementTypeValues),
    ...achievementContentFields,
  }),
);

export type CreateAchievementValues = z.infer<typeof createAchievementSchema>;

/**
 * Admin-submitted edit form for an existing DRAFT achievement.
 * `achievementId` is a route/resource identifier only — the server
 * independently re-verifies status (DRAFT) before applying any change.
 * `studentId` is deliberately absent — it can never be changed by this
 * form (see "Update Achievement RPC").
 */
export const updateAchievementSchema = withAchievementContextRefinements(
  z.object({
    achievementId: z.string().uuid(),
    achievementType: z.enum(achievementTypeValues),
    ...achievementContentFields,
  }),
);

export type UpdateAchievementValues = z.infer<typeof updateAchievementSchema>;
