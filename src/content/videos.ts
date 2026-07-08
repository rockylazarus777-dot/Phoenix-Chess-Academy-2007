/**
 * Authoritative video records — the single source of truth for /videos
 * and the home page's `VideoExperience` preview.
 *
 * NO FAKE DATA: no video records have been supplied yet, so `videos` is
 * intentionally an empty array. Do not invent YouTube video IDs or
 * titles — a fabricated ID would embed either nothing or someone else's
 * unrelated video.
 *
 * Migration note (future Supabase move): this shape maps directly onto a
 * `videos` table — `id` as the natural key.
 */

export type VideoCategory = "ACADEMY" | "TRAINING" | "TOURNAMENT" | "STUDENT" | "COACHING" | "EVENT" | "OTHER";

export const videoCategoryLabels: Record<VideoCategory, string> = {
  ACADEMY: "Academy",
  TRAINING: "Training",
  TOURNAMENT: "Tournament",
  STUDENT: "Student",
  COACHING: "Coaching",
  EVENT: "Event",
  OTHER: "Other",
};

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtubeVideoId: string;
  /** Falls back to the YouTube-hosted thumbnail (`getVideoThumbnail`) when not set. */
  thumbnail?: string;
  category: VideoCategory;
  durationLabel?: string;
  featured: boolean;
  active: boolean;
  displayOrder: number;
}

/** No real Phoenix YouTube video IDs have been supplied yet — kept empty intentionally. */
export const videos: VideoItem[] = [];

export function getVideos(): VideoItem[] {
  return videos.filter((video) => video.active).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFeaturedVideo(): VideoItem | undefined {
  return getVideos().find((video) => video.featured);
}

export function getVideoCategoriesInUse(): VideoCategory[] {
  const categories = new Set(getVideos().map((video) => video.category));
  return Array.from(categories);
}

export function getVideosByCategory(category: VideoCategory): VideoItem[] {
  return getVideos().filter((video) => video.category === category);
}

/** YouTube's own hosted thumbnail — a safe fallback when no custom thumbnail is configured, since the video ID is itself real/confirmed once one exists. */
export function getVideoThumbnail(video: VideoItem): string {
  return video.thumbnail ?? `https://i.ytimg.com/vi/${video.youtubeVideoId}/hqdefault.jpg`;
}
