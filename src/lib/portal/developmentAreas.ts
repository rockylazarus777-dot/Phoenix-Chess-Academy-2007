import type { DevelopmentArea } from "@/lib/supabase/types";

/**
 * Display labels for the controlled `development_area` enum
 * (supabase/migrations/0021_student_progress_evaluations.sql). Shared,
 * non-role-specific, cross-portal constant — the area name itself is not
 * privacy-sensitive (unlike its association with a specific student's
 * rating, which every caller already resolves through its own
 * privacy-scoped RPC before rendering). See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Development Area Architecture".
 */
export const DEVELOPMENT_AREA_LABELS: Record<DevelopmentArea, string> = {
  OPENING: "Opening",
  MIDDLEGAME: "Middlegame",
  ENDGAME: "Endgame",
  TACTICS: "Tactics",
  CALCULATION: "Calculation",
  POSITIONAL_PLAY: "Positional Play",
  TIME_MANAGEMENT: "Time Management",
  CONCENTRATION: "Concentration",
  DECISION_MAKING: "Decision Making",
  TOURNAMENT_PREPARATION: "Tournament Preparation",
};

/**
 * Stable rating-scale semantics — a 1-5 internal development-assessment
 * scale, never a percentage/Elo-like/FIDE-style score and never implying a
 * FIDE title or federation qualification. Deliberately not "Poor"/"Bad"/
 * "Weak Student"/"Failure"/"Expert"/"Master"/"Grandmaster". See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Rating Scale Semantics".
 */
export const DEVELOPMENT_RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Needs Significant Development",
  2: "Developing",
  3: "Progressing",
  4: "Strong",
  5: "Advanced",
};

export function getDevelopmentRatingLabel(rating: number): string {
  return DEVELOPMENT_RATING_LABELS[rating as 1 | 2 | 3 | 4 | 5] ?? `${rating}`;
}
