/**
 * Authoritative achievement records — the single source of truth for
 * /achievements and the home page's `AchievementsShowcase` preview.
 *
 * NO FAKE DATA: no achievement records have been supplied yet, so
 * `achievements` is intentionally an empty array. Do not invent student
 * names, tournament results, placements, ratings, or years. Every
 * consumer of this file renders an honest empty-state (general,
 * source-supported wording) instead of fabricated cards — see
 * `/achievements` and `AchievementsShowcase.tsx`.
 *
 * Migration note (future Supabase move): this shape is designed to map
 * directly onto an `achievements` table — `id` as the natural key,
 * `relatedTournamentSlug` as a foreign key once `tournaments` is
 * populated. `getFeaturedAchievements`/`getAchievementsByType` are the
 * seams that would change to a Supabase query; page components would
 * not need to change.
 */

export type AchievementType = "STUDENT" | "ACADEMY" | "TOURNAMENT" | "RECORD" | "MEDIA" | "OTHER";

export interface Achievement {
  id: string;
  slug?: string;
  title: string;
  description: string;
  achievementType: AchievementType;
  studentName?: string;
  teamName?: string;
  tournamentName?: string;
  level?: string;
  placement?: string;
  year?: number;
  date?: string;
  image: string;
  imageAlt: string;
  relatedTournamentSlug?: string;
  /** Program slug(s) this achievement is relevant to — used by ProgramAchievements on /programs/[slug] instead of duplicating achievement objects inside src/content/programs.ts. */
  relatedProgramSlugs?: string[];
  featured: boolean;
  active: boolean;
  displayOrder: number;
}

/** No real achievement records have been supplied yet — kept empty intentionally. */
export const achievements: Achievement[] = [];

export function getAchievements(): Achievement[] {
  return achievements.filter((achievement) => achievement.active).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFeaturedAchievements(): Achievement[] {
  return getAchievements().filter((achievement) => achievement.featured);
}

export function getAchievementsByType(type: AchievementType): Achievement[] {
  return getAchievements().filter((achievement) => achievement.achievementType === type);
}
