import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderScrollShell } from "@/components/layout/HeaderScrollShell";
import { ctaNavigation } from "@/config/navigation";

/**
 * Public site navbar. Server-rendered by default; interactivity (dropdowns,
 * mobile panel, scroll-aware background) lives in focused client islands
 * (DesktopNav, MobileNav, HeaderScrollShell).
 */
export function Navbar() {
  return (
    <HeaderScrollShell>
      <Container className="flex h-18 items-center justify-between">
        <Logo priority height={32} />

        <DesktopNav />

        <div className="hidden lg:flex items-center gap-3">
          <Button href={ctaNavigation.login.href} variant="ghost" size="sm">
            {ctaNavigation.login.label}
          </Button>
          <Button href={ctaNavigation.primary.href} variant="primary" size="sm">
            {ctaNavigation.primary.label}
          </Button>
        </div>

        <MobileNav />
      </Container>
    </HeaderScrollShell>
  );
}
