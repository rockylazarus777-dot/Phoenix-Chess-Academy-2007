import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { ContactDetails } from "@/components/ui/ContactDetails";
import { footerNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";

interface FooterLinkColumnProps {
  title: string;
  links: { label: string; href: string }[];
}

function FooterLinkColumn({ title, links }: FooterLinkColumnProps) {
  return (
    <div>
      <h3 className="text-caption text-muted-foreground mb-4">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-body-sm text-foreground/80 hover:text-primary-text transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Scalable public site footer.
 *
 * Contact details and social icons only render when a real value exists in
 * siteConfig — handled by the shared ContactDetails component (also used
 * on /contact) so this logic isn't duplicated.
 */
export function Footer() {
  return (
    <footer className="on-dark bg-background border-t border-primary/30">
      <Container className="py-14 lg:py-18">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-6">
          <div className="col-span-2">
            <Logo height={30} />
            <p className="text-body-sm text-muted-foreground mt-4 max-w-xs">
              {siteConfig.description}
            </p>
            <ContactDetails className="mt-6" />
          </div>

          <FooterLinkColumn title="Programs" links={footerNavigation.programs} />
          <FooterLinkColumn title="Academy" links={footerNavigation.academy} />
          <FooterLinkColumn title="Tournaments" links={footerNavigation.tournaments} />
          <FooterLinkColumn title="Resources" links={footerNavigation.resources} />
        </div>

        <div className="mt-14 flex flex-col-reverse gap-4 border-t border-border pt-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-body-sm text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {footerNavigation.legal.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-body-sm text-muted-foreground hover:text-primary-text transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
