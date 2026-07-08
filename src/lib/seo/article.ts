import { siteConfig, getSiteUrl } from "@/config/site";
import type { BlogPost } from "@/content/blog";

/**
 * BlogPosting JSON-LD for a single blog article. Only includes fields
 * that are actually configured on the post — no invented author
 * identity (never defaults to the founder unless a post genuinely names
 * her as author), no invented cover image, no invented dates. This
 * function is only ever called for a real, existing post — there is no
 * JSON-LD for a slug that doesn't resolve to a post.
 */
export function buildArticleSchema(post: BlogPost) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/blog/${post.slug}`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteUrl,
    },
  };

  if (post.updatedAt) schema.dateModified = post.updatedAt;
  if (post.coverImage) schema.image = `${siteUrl}${post.coverImage}`;

  return schema;
}
