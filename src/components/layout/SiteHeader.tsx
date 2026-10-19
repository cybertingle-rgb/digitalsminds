import { BrandLogo } from "@/components/brand/BrandLogo";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-4">
        <BrandLogo />
        <nav aria-label="Main" className="hidden md:block">
          <NavLinks items={siteConfig.nav} />
        </nav>
        <div className="hidden md:block">
          <LinkButton href={siteConfig.primaryCta.href} className="py-2">
            {siteConfig.primaryCta.label}
          </LinkButton>
        </div>
        <MobileNav items={siteConfig.nav} cta={siteConfig.primaryCta} />
      </Container>
    </header>
  );
}
