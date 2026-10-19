import { BrandLogo } from "@/components/brand/BrandLogo";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = siteConfig.nav.map((n) => ({ label: dict.nav[n.key], href: localizePath(n.href, locale) }));
  const homeHref = localizePath("/", locale);
  const cta = { label: dict.nav.cta, href: localizePath(siteConfig.primaryCtaHref, locale) };
  const switcher = features.urduPublic ? <LanguageSwitcher label={dict.a11y.languageSwitcher} /> : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <Container className="relative flex h-18 items-center justify-between gap-4">
        <BrandLogo locale={locale} alt={dict.brand.logoAlt} homeLabel={dict.a11y.homeLink} priority className="h-12 w-auto sm:h-14" />
        <nav aria-label={dict.a11y.mainNav} className="hidden md:block">
          <NavLinks items={items} homeHref={homeHref} />
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {switcher}
          <LinkButton href={cta.href} className="py-2">
            {cta.label}
          </LinkButton>
        </div>
        <MobileNav
          items={items}
          homeHref={homeHref}
          cta={cta}
          labels={{ open: dict.a11y.openMenu, close: dict.a11y.closeMenu, nav: dict.a11y.mobileNav }}
          extra={switcher}
        />
      </Container>
    </header>
  );
}
