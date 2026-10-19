import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { services } from "@/content/services";
import { ContactChannels } from "./ContactChannels";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-950 text-brand-100">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <BrandLogo inverse />
          <p className="mt-2 text-sm font-semibold tracking-wide text-accent-400">{siteConfig.tagline}</p>
          <p className="mt-4 max-w-sm text-sm text-brand-200">{siteConfig.positioning}.</p>
          <ContactChannels className="mt-6 text-sm" inverse />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Services</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="hover:text-white">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Company</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {siteConfig.nav
              .filter((n) => n.href !== "/")
              .map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-white">
                    {n.label}
                  </Link>
                </li>
              ))}
            {siteConfig.social.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-6 text-xs text-brand-200">
          © {year} {siteConfig.name}. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
