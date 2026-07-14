/**
 * Central site configuration for Phoenix Chess Academy.
 *
 * This is the single source of truth for brand identity, the production
 * domain, and contact/social placeholders. Never hardcode the production
 * URL, brand name, or contact details anywhere else in the codebase —
 * import them from here.
 *
 * CONFIRMED CONTENT LOCK (see PHOENIX_REAL_CONTENT_MASTER.md, Section 3):
 * phone, WhatsApp, email, and postal address below are owner-confirmed
 * and safe to render publicly. Social links remain empty — no official
 * URL has been confirmed for any platform yet.
 */

export const siteConfig = {
  name: "Phoenix Chess Academy",
  shortName: "Phoenix",
  legalName: "Phoenix Chess Academy",
  description:
    "Phoenix Chess Academy trains disciplined, competitive chess players through professional coaching, structured student development, and state-level tournaments.",
  // Confirmed canonical production host is the `www` subdomain — this is
  // the exact domain Supabase's Site URL / Redirect URL allow-list is
  // configured for, and the one every invite/reset email link must
  // resolve to. `getSiteUrl()` below only falls back to this constant
  // when `NEXT_PUBLIC_SITE_URL` is missing/misconfigured in the actual
  // deployment — keeping this fallback correct matters because a silent
  // fallback to the wrong host would send every auth redirectTo (and
  // every SEO canonical/sitemap/structured-data URL, which route through
  // the same getSiteUrl()) to a domain Supabase never agreed to trust.
  domain: "www.phoenixchessacademy.org",
  url: "https://www.phoenixchessacademy.org",
  locale: "en",
  defaultTitle: "Phoenix Chess Academy | Professional Chess Training",
  titleTemplate: "%s | Phoenix Chess Academy",

  /**
   * Confirmed contact information (CONFIRMED — owner-approved for public
   * display). Phone and WhatsApp currently use the same number.
   */
  contact: {
    email: "info@phoenixchessacademy.org",
    phone: "+91 63696 87328",
    whatsapp: "+91 63696 87328",
    address: {
      line1: "73A, 13th St, Ram Nagar, Kuberan Nagar",
      line2: "Madipakkam",
      city: "Chennai",
      state: "Tamil Nadu",
      country: "India",
      postalCode: "600091",
    },
  },

  /**
   * Official social media profiles.
   * Do not invent URLs. Populate only when the academy provides the
   * official handle/URL for a given platform.
   */
  social: {
    instagram: "",
    facebook: "",
    youtube: "",
    twitter: "",
    linkedin: "",
  },

  /**
   * Analytics / tracking placeholders — wired up in a later phase.
   * Values are sourced from environment variables, never hardcoded.
   */
  analytics: {
    gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
    gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
    clarityId: process.env.NEXT_PUBLIC_CLARITY_ID ?? "",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/**
 * Resolves the production site URL from the environment, falling back to
 * the canonical production domain. Use this (not a literal string) whenever
 * an absolute URL is required — metadata, sitemap, structured data, emails.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url;
}
