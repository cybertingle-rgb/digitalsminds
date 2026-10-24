import { notFound } from "next/navigation";
import { CookieConsent } from "@/components/analytics/CookieConsent";
import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SocialRail } from "@/components/effects/SocialLinks";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAnalyticsSetting } from "@/modules/content/settings";

/** Public marketing site shell. Phase 2 portal/admin get their own route groups. */
export default async function MarketingLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const { gaId } = await getAnalyticsSetting();
  return (
    <CurrencyProvider labels={dict.currency} locale={lang}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2"
      >
        {dict.a11y.skipToContent}
      </a>
      <SiteHeader locale={lang} dict={dict} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={lang} dict={dict} />
      <SocialRail label={dict.a11y.social} />
      <WhatsAppButton dict={dict} locale={lang} />
      <CookieConsent gaId={gaId} labels={dict.consent} privacyHref={localizePath("/privacy", lang)} />
    </CurrencyProvider>
  );
}
