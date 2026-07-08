import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/config/site";
import { getPrograms } from "@/content/programs";
import { getTournaments, hasMeaningfulResults } from "@/content/tournaments";
import { getBlogPosts } from "@/content/blog";

/**
 * Static, always-valid public marketing routes. Portal/auth/admin
 * segments (`/admin`, `/portal`, `/parent`, `/coach`, `(auth)` routes)
 * and internal API routes are intentionally excluded — they are not
 * public content. `/book-trial` and tournament registration pages are
 * also excluded: registration forms are explicitly `noindex` (see
 * `buildMetadata({ index: false })` in
 * `src/app/(public)/tournaments/[slug]/register/page.tsx`) since they're
 * thin transactional forms, not indexable content in their own right —
 * `/book-trial` is the one exception kept in the sitemap since it is the
 * academy's primary top-level conversion page, not a per-tournament form.
 */
const staticRoutes = [
  "/",
  "/about",
  "/about/our-story",
  "/about/vision-mission",
  "/about/leadership",
  "/coaches",
  "/contact",
  "/faq",
  "/programs",
  "/book-trial",
  "/tournaments",
  "/achievements",
  "/champions",
  "/gallery",
  "/videos",
  "/blog",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/cookie-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${siteUrl}${path}`,
  }));

  // Dynamic program routes — always real, since getPrograms() only
  // returns active, authored entries from src/content/programs.ts.
  for (const program of getPrograms()) {
    entries.push({ url: `${siteUrl}/programs/${program.slug}` });
  }

  // Dynamic tournament routes — only included when a real, active
  // tournament exists (getTournaments() is empty until one is added, so
  // this loop currently contributes nothing, by design — no fabricated
  // tournament URLs). Results pages are included only once a tournament
  // has real, meaningful results (mirrors that page's own `index` logic).
  // Registration pages are never included — they are noindex forms.
  for (const tournament of getTournaments()) {
    entries.push({ url: `${siteUrl}/tournaments/${tournament.slug}` });
    if (hasMeaningfulResults(tournament)) {
      entries.push({ url: `${siteUrl}/tournaments/${tournament.slug}/results` });
    }
  }

  // Dynamic blog routes — only included for real, active posts (empty
  // until src/content/blog.ts has entries).
  for (const post of getBlogPosts()) {
    entries.push({ url: `${siteUrl}/blog/${post.slug}` });
  }

  return entries;
}
