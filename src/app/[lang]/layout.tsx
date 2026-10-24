import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { hasLocale, localeMeta, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAnalyticsSetting } from "@/modules/content/settings";
import { CAMPAIGN_HEAD_SCRIPT } from "@/components/analytics/campaign-script";
import { AmbientBackground } from "@/components/effects/AmbientBackground";
import { GlowTracker } from "@/components/effects/GlowTracker";
import { NavigationProgress } from "@/components/effects/NavigationProgress";
import { Preloader, PRELOADER_END_SCRIPT, PRELOADER_HEAD_SCRIPT } from "@/components/effects/Preloader";
import { naskh } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  const { googleVerification } = await getAnalyticsSetting();
  return {
    ...(googleVerification && { verification: { google: googleVerification } }),
    metadataBase: new URL(siteConfig.url),
    title: { default: dict.meta.siteTitle, template: `%s | ${dict.brand.name}` },
    description: dict.meta.description,
    applicationName: dict.brand.name,
    openGraph: { type: "website", siteName: dict.brand.name, title: dict.meta.siteTitle, description: dict.meta.description },
    twitter: { card: "summary_large_image" },
  };
}

// Editable website content (Admin → Website) is re-read at least every minute; saving refreshes it at once.
export const revalidate = 60;

export const viewport: Viewport = { themeColor: "#2b323c" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { htmlLang, dir } = localeMeta[lang];
  return (
    <html lang={htmlLang} dir={dir} className={naskh.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_HEAD_SCRIPT + CAMPAIGN_HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Preloader label={getDictionary(lang).brand.name} />
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_END_SCRIPT }} />
        <NavigationProgress label={getDictionary(lang).a11y.loading} />
        <AmbientBackground />
        <GlowTracker />
        {children}
      </body>
    </html>
  );
}
