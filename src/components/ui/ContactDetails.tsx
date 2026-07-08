import { siteConfig } from "@/config/site";

const socialPlatforms = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "Twitter / X" },
  { key: "linkedin", label: "LinkedIn" },
] as const;

interface ContactDetailsProps {
  className?: string;
}

/**
 * Builds a wa.me link from a phone number — WhatsApp's own link format
 * requires digits only (no "+", spaces, or punctuation).
 */
function buildWhatsAppUrl(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digitsOnly}`;
}

/**
 * Renders confirmed contact info only — email/phone/WhatsApp/address/
 * social links are individually omitted when not configured in
 * siteConfig, rather than showing placeholder text. Shared between the
 * Footer and the Contact page.
 */
export function ContactDetails({ className }: ContactDetailsProps) {
  const { contact, social } = siteConfig;
  const hasAddress = Boolean(contact.address.city || contact.address.line1);
  const activeSocialLinks = socialPlatforms.filter((platform) => social[platform.key]);
  const hasAnything = Boolean(contact.email || contact.phone || contact.whatsapp || hasAddress || activeSocialLinks.length > 0);

  if (!hasAnything) {
    return (
      <p className={className}>
        <span className="text-body-sm text-muted-foreground">
          Contact details will appear here once the academy confirms them — use the enquiry form in the meantime.
        </span>
      </p>
    );
  }

  return (
    <div className={className}>
      <ul className="flex flex-col gap-1.5 text-body-sm text-foreground/80">
        {contact.email ? (
          <li>
            <a href={`mailto:${contact.email}`} className="hover:text-primary-text transition-colors">
              {contact.email}
            </a>
          </li>
        ) : null}
        {contact.phone ? (
          <li>
            <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="hover:text-primary-text transition-colors">
              {contact.phone}
            </a>
          </li>
        ) : null}
        {contact.whatsapp ? (
          <li>
            <a
              href={buildWhatsAppUrl(contact.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-text transition-colors"
            >
              WhatsApp: {contact.whatsapp}
            </a>
          </li>
        ) : null}
        {hasAddress ? (
          <li className="text-muted-foreground">
            {[
              contact.address.line1,
              contact.address.line2,
              contact.address.city,
              contact.address.state,
              contact.address.postalCode,
              contact.address.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </li>
        ) : null}
      </ul>

      {activeSocialLinks.length > 0 ? (
        <ul className="mt-4 flex items-center gap-3">
          {activeSocialLinks.map((platform) => (
            <li key={platform.key}>
              <a
                href={social[platform.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-muted-foreground hover:text-primary-text transition-colors"
              >
                {platform.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
