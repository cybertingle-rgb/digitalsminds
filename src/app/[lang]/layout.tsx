import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { hasLocale, localeMeta, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { naskh } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: dict.meta.siteTitle, template: `%s | ${dict.brand.name}` },
    description: dict.meta.description,
    applicationName: dict.brand.name,
    openGraph: { type: "website", siteName: dict.brand.name, title: dict.meta.siteTitle, description: dict.meta.description },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#2b323c" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { htmlLang, dir } = localeMeta[lang];
  return (
    <html lang={htmlLang} dir={dir} className={naskh.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
