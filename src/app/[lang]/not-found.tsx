import { lang } from "next/root-params";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { defaultLocale, hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const value = await lang();
  const locale = hasLocale(value) ? value : defaultLocale;
  const dict = getDictionary(locale);
  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main id="main" className="flex-1">
        <Container className="py-24 text-center">
          <p className="text-sm font-semibold text-gold-700" dir="ltr">404</p>
          <h1 className="mt-2 text-3xl font-bold text-charcoal-900 sm:text-4xl">{dict.errors.notFoundTitle}</h1>
          <p className="mt-4 text-muted">{dict.errors.notFoundText}</p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href={localizePath("/", locale)}>{dict.errors.goHome}</LinkButton>
            <LinkButton href={localizePath("/contact", locale)} variant="secondary">
              {dict.errors.contactUs}
            </LinkButton>
          </div>
        </Container>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
