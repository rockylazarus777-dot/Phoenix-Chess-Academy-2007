/**
 * Authoritative media gallery records — the single source of truth for
 * /gallery and the home page's `TournamentHighlights` preview.
 *
 * NO FAKE DATA: no gallery records have been supplied yet, so
 * `galleryItems` is intentionally an empty array. Do not invent event
 * names, dates, or captions, and never substitute stock/AI-generated
 * imagery — the owner has confirmed real Phoenix photography will be
 * supplied directly.
 *
 * IMPORTANT — INTERNATIONAL category: this is a media/context category
 * only (e.g. an online session with an international student, or media
 * referencing international-facing training). It must never be used to
 * imply Phoenix operates physical branches outside Chennai — see
 * `src/config/site.ts` and `docs/DATABASE_ARCHITECTURE.md` for the
 * confirmed single-location academy structure.
 *
 * Migration note (future Supabase move): this shape maps directly onto a
 * `gallery_items` table — `id` as the natural key, `tournamentSlug` as a
 * foreign key once `tournaments` is populated.
 */

export type GalleryCategory =
  | "ACADEMY"
  | "TRAINING"
  | "TOURNAMENT"
  | "ACHIEVEMENT"
  | "EVENT"
  | "MEDIA"
  | "INTERNATIONAL"
  | "OTHER";

export const galleryCategoryLabels: Record<GalleryCategory, string> = {
  ACADEMY: "Academy",
  TRAINING: "Training",
  TOURNAMENT: "Tournament",
  ACHIEVEMENT: "Achievement",
  EVENT: "Event",
  MEDIA: "Media",
  INTERNATIONAL: "International",
  OTHER: "Other",
};

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  image: string;
  alt: string;
  category: GalleryCategory;
  eventName?: string;
  tournamentSlug?: string;
  date?: string;
  featured: boolean;
  active: boolean;
  displayOrder: number;
}

/** No real gallery images have been supplied yet — kept empty intentionally. */
export const galleryItems: GalleryItem[] = [];

export function getGalleryItems(): GalleryItem[] {
  return galleryItems.filter((item) => item.active).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFeaturedGalleryItems(): GalleryItem[] {
  return getGalleryItems().filter((item) => item.featured);
}

/** Only categories that actually have at least one active item — never render a filter for an empty category. */
export function getGalleryCategoriesInUse(): GalleryCategory[] {
  const categories = new Set(getGalleryItems().map((item) => item.category));
  return Array.from(categories);
}

export function getGalleryItemsByCategory(category: GalleryCategory): GalleryItem[] {
  return getGalleryItems().filter((item) => item.category === category);
}
