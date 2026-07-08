import { siteConfig, getSiteUrl } from "@/config/site";
import type { Program } from "@/content/programs";

/**
 * Course JSON-LD for a program detail page. Only includes fields that are
 * actually true of the content we have — no price, offers, duration,
 * educational credential, workload, rating, or reviews, since none of
 * that is confirmed. Do not add these fields speculatively later without
 * the underlying data actually existing.
 */
export function buildCourseSchema(program: Program) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: program.name,
    description: program.description,
    url: `${siteUrl}/programs/${program.slug}`,
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteUrl,
    },
  };
}
