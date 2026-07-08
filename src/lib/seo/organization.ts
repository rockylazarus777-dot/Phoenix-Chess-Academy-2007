import { siteConfig, getSiteUrl } from "@/config/site";

/**
 * Organization JSON-LD for the home page. Only includes fields with real,
 * confirmed values — no placeholder phone/email/address. The official
 * logo file now exists (`/images/brand/phoenix-logo.jpg`), so it's
 * included here.
 */
export function buildOrganizationSchema() {
  const siteUrl = getSiteUrl();
  const { contact, social } = siteConfig;

  const sameAs = Object.values(social).filter((url) => url.length > 0) as string[];

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteUrl,
    description: siteConfig.description,
    logo: `${siteUrl}/images/brand/phoenix-logo.jpg`,
  };

  if (contact.email) schema.email = contact.email;
  if (contact.phone) schema.telephone = contact.phone;
  if (contact.address.city || contact.address.line1) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: contact.address.line1 || undefined,
      addressLocality: contact.address.city || undefined,
      addressRegion: contact.address.state || undefined,
      addressCountry: contact.address.country || undefined,
      postalCode: contact.address.postalCode || undefined,
    };
  }
  if (sameAs.length > 0) schema.sameAs = sameAs;

  return schema;
}
