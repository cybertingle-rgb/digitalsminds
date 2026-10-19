"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeMeta, locales, localizePath, splitLocale } from "@/i18n/config";

/** Links to the same page in each language. */
export function LanguageSwitcher({ label }: { label: string }) {
  const pathname = usePathname();
  const { locale: current, path } = splitLocale(pathname);
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={localizePath(path, locale)}
          hrefLang={localeMeta[locale].htmlLang}
          lang={localeMeta[locale].htmlLang}
          aria-current={locale === current ? "true" : undefined}
          className={`rounded-md px-2 py-1 ${
            locale === current ? "bg-charcoal-900 text-white" : "text-muted hover:bg-charcoal-50 hover:text-charcoal-900"
          }`}
        >
          {localeMeta[locale].label}
        </Link>
      ))}
    </nav>
  );
}
