import type { Metadata } from "next";
import { siteConfig, getSiteUrl } from "@/config/site";

interface BuildMetadataOptions {
  title: string;
  description: string;
  /** Path only, e.g. "/programs/beginner-chess". Combined with the site URL for canonical + OG. */
  path?: string;
  /** Set false for pages that should not be indexed (e.g. utility/auth pages). */
  index?: boolean;
  /** Open Graph image path relative to /public. Falls back to the default OG image. */
  ogImage?: string;
}

/**
 * Builds page-specific Next.js Metadata from a small set of inputs, so
 * every route gets a unique title/description/canonical instead of
 * inheriting a single shared metadata block.
 */
export function buildMetadata({
  title,
  description,
  path = "/",
  index = true,
  ogImage = "/images/brand/og-default.jpg",
}: BuildMetadataOptions): Metadata {
  const url = new URL(path, getSiteUrl()).toString();

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [{ url: ogImage }],
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
