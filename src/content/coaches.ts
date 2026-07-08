/**
 * Coach data — single source of truth, consumed by both the public
 * /coaches page and the home page's coach preview section. No coach has
 * been confirmed yet, so this is an empty, fully-typed array rather than
 * invented names, chess titles, FIDE IDs, or achievements. Populate this
 * array once the academy provides real coach data; both consuming pages
 * pick it up automatically.
 */
export interface Coach {
  id: string;
  slug: string;
  name: string;
  role: string;
  image: string;
  chessTitle?: string;
  fideId?: string;
  fideRating?: number;
  specializations?: string[];
  languages?: string[];
  trainingModes?: Array<"online" | "offline">;
  shortBio: string;
  fullBio?: string;
  achievements?: string[];
  profileUrl?: string;
  /** Program slug(s) this coach is associated with, for program-page linkage. */
  relatedProgramSlugs?: string[];
  active: boolean;
}

/** No real coach roster supplied yet — kept empty intentionally. */
export const coaches: Coach[] = [];
