/**
 * Phoenix's authoritative training methodology — the single typed source
 * for how Phoenix trains, used by the Programs system (listing + per-
 * program detail pages). Do not duplicate these descriptions into
 * home.ts, about.ts, or programs.ts — import from here and select the
 * relevant subset per page instead.
 *
 * CONTENT PASS 2 (cleanup + content-lock): restored from the academy's
 * prior website as SOURCE-SUPPORTED DRAFT — themes are source-supported
 * (individual development, tactical training, opening/middlegame/
 * endgame foundations, practical play, clock training for competitive
 * players, tournament experience, focused/private coaching, online
 * learning), phrased here rather than claimed as a direct quote. See
 * PHOENIX_REAL_CONTENT_MASTER.md, Section 7, for the full classification.
 *
 * Migration note (future Supabase move): maps directly onto a
 * `training_methodology` table — `id` as the natural key,
 * `relevantProgramSlugs` as a join table or jsonb column, `displayOrder`
 * for stable ordering.
 */

export interface TrainingMethodologyItem {
  id: string;
  title: string;
  description: string;
  /** Omit for methodology items relevant to every program. */
  relevantProgramSlugs?: string[];
  displayOrder: number;
}

export const trainingMethodology: TrainingMethodologyItem[] = [
  {
    id: "individual-development",
    title: "Individual Development",
    description: "Training considers the student's current chess experience and development needs.",
    displayOrder: 1,
  },
  {
    id: "tactical-development",
    title: "Tactical Development",
    description: "Pattern recognition, tactical exercises, and practical tactical awareness.",
    displayOrder: 2,
  },
  {
    id: "chess-foundation-and-development",
    title: "Chess Foundation and Development",
    description: "Opening principles and preparation, middlegame understanding, and endgame development according to the student's level.",
    displayOrder: 3,
  },
  {
    id: "practical-play",
    title: "Practical Play",
    description: "Students apply chess concepts through practical game experience.",
    displayOrder: 4,
  },
  {
    id: "clock-training",
    title: "Clock Training",
    description: "Competitive players may develop practical time-management awareness through clock-based play.",
    relevantProgramSlugs: ["intermediate-chess", "advanced-chess", "professional-training", "tournament-preparation"],
    displayOrder: 5,
  },
  {
    id: "tournament-experience",
    title: "Tournament Experience",
    description: "Competitive chess experience supports practical decision-making and tournament preparation.",
    relevantProgramSlugs: ["advanced-chess", "professional-training", "tournament-preparation"],
    displayOrder: 6,
  },
  {
    id: "focused-coaching",
    title: "Focused Coaching",
    description: "Private and focused training can support individual chess development.",
    displayOrder: 7,
  },
  {
    id: "online-learning",
    title: "Online Learning",
    description: "Phoenix supports technology-enabled and interactive chess learning.",
    relevantProgramSlugs: ["online-chess-coaching"],
    displayOrder: 8,
  },
];

/** Full methodology, in display order — used on the general /programs listing page. */
export function getTrainingMethodology(): TrainingMethodologyItem[] {
  return [...trainingMethodology].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Methodology items relevant to one specific program — universal items
 * (no `relevantProgramSlugs`) plus any item that lists this slug. Used
 * on /programs/[slug] so a program detail page doesn't force all eight
 * items when only some apply.
 */
export function getTrainingMethodologyForProgram(slug: string): TrainingMethodologyItem[] {
  return getTrainingMethodology().filter(
    (item) => !item.relevantProgramSlugs || item.relevantProgramSlugs.includes(slug)
  );
}
