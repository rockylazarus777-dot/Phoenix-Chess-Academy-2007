/**
 * Authoritative blog/resource content — the single source of truth for
 * /blog, /blog/[slug], and the home page's `ResourcesPreview`.
 *
 * This is a STATIC content architecture, not a CMS. Posts are added by
 * editing `blogPosts` below, not through an editor UI (out of scope for
 * Phase 8).
 *
 * NO FAKE DATA: no real Phoenix blog posts have been supplied yet, so
 * `blogPosts` is intentionally an empty array. Do not invent tournament
 * announcements, student achievements, founder quotes, academy news,
 * awards, partnerships, or international branches to fill the page —
 * `/blog` renders an honest, educational-resource-direction introduction
 * instead. See `/blog` and `ResourcesPreview.tsx`.
 *
 * CONTENT-BLOCK ARCHITECTURE: `content` is an array of typed blocks
 * (paragraph/heading/list/quote), not a Markdown string and not raw
 * HTML — this avoids both installing a Markdown parser for a handful of
 * posts and ever needing `dangerouslySetInnerHTML`.
 *
 * Migration note (future Supabase move): this shape maps onto a
 * `blog_posts` table with `content` as a jsonb column (the block array
 * has no independent per-block identity worth normalizing into its own
 * table — same reasoning as `tournaments.highlights` in
 * docs/DATABASE_ARCHITECTURE.md).
 */

export type BlogContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level?: 2 | 3 }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "quote"; text: string; attribution?: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: BlogContentBlock[];
  publishedAt: string;
  updatedAt?: string;
  /** Only ever set this to a real person who actually wrote/reviewed the post — never default to the founder. */
  author: string;
  category: string;
  tags: string[];
  coverImage?: string;
  coverImageAlt?: string;
  featured: boolean;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

/** No real Phoenix blog posts have been supplied yet — kept empty intentionally. */
export const blogPosts: BlogPost[] = [];

export function getBlogPosts(): BlogPost[] {
  return [...blogPosts]
    .filter((post) => post.active)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getFeaturedBlogPost(): BlogPost | undefined {
  return getBlogPosts().find((post) => post.featured) ?? getBlogPosts()[0];
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.active && post.slug === slug);
}

export function getBlogCategoriesInUse(): string[] {
  const categories = new Set(getBlogPosts().map((post) => post.category));
  return Array.from(categories);
}

export function getRelatedBlogPosts(post: BlogPost, max = 3): BlogPost[] {
  return getBlogPosts()
    .filter((candidate) => candidate.slug !== post.slug && candidate.category === post.category)
    .slice(0, max);
}
