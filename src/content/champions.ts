/**
 * Authoritative champion / Hall of Fame records — the single source of
 * truth for /champions and the home page's `HallOfFame` preview.
 *
 * NO FAKE DATA: no champion records have been supplied yet, so
 * `champions` is intentionally an empty array. Do not invent names,
 * FIDE IDs, ratings, titles, or years, and do not represent an
 * anonymous/fake student with a silhouette placeholder. The consuming
 * pages render an honest Hall of Fame introduction instead — see
 * `/champions` and `HallOfFame.tsx`.
 *
 * Migration note (future Supabase move): this shape maps directly onto a
 * `champions` table — `id` as the natural key, `programSlugs` as a join
 * table or jsonb column.
 */

export interface Champion {
  id: string;
  slug?: string;
  name: string;
  photo: string;
  photoAlt: string;
  title: string;
  summary: string;
  achievements: string[];
  fideId?: string;
  fideRating?: number;
  year?: number;
  programSlugs?: string[];
  featured: boolean;
  active: boolean;
  displayOrder: number;
}

/** No real champion records have been supplied yet — kept empty intentionally. */
export const champions: Champion[] = [];

export function getChampions(): Champion[] {
  return champions.filter((champion) => champion.active).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFeaturedChampions(): Champion[] {
  return getChampions().filter((champion) => champion.featured);
}
