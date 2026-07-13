import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/config/site";

/**
 * robots.txt — crawler guidance only, not an access-control mechanism.
 * Real protection for portal/admin routes comes from Supabase Auth +
 * server-side role checks (src/lib/auth/requireRole.ts), not from this
 * file; disallowing a path here only asks well-behaved crawlers not to
 * index it. Auth routes (/login, /forgot-password, /reset-password,
 * /accept-invite, /auth/callback) are included here as additional crawler
 * guidance on top of their own per-page `noindex` metadata
 * (buildMetadata({ index: false })) — belt-and-suspenders, not a
 * substitute for it.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/portal",
        "/parent",
        "/coach",
        "/api/internal",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/accept-invite",
        "/auth/callback",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
