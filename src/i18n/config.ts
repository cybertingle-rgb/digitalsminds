/**
 * Locale configuration. English is served without a prefix ("/about"),
 * Urdu under "/ur" ("/ur/about"). Safe to import from client components.
 */

export const locales = ["en", "ur"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeMeta: Record<Locale, { dir: "ltr" | "rtl"; htmlLang: string; intl: string; label: string }> = {
  en: { dir: "ltr", htmlLang: "en", intl: "en-US", label: "English" },
  ur: { dir: "rtl", htmlLang: "ur", intl: "ur-PK", label: "اردو" },
};

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** "/about" + "ur" -> "/ur/about"; "/about" + "en" -> "/about". */
export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * "/ur/about" -> { locale: "ur", path: "/about" }; "/about" -> { locale: "en", path: "/about" }.
 * Also accepts the internal "/en/about" form that English pages are rendered
 * under on the server (see resolveLocaleRoute), so server and browser agree.
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && hasLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: defaultLocale, path: pathname || "/" };
}

/** Public URL for any pathname form: "/en/about" -> "/about", "/ur/about" stays. */
export function publicPathname(pathname: string): string {
  const { locale, path } = splitLocale(pathname);
  return localizePath(path, locale);
}

export type LocaleRoute =
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; pathname: string }
  | { action: "next" };

/**
 * Routing rule used by src/proxy.ts:
 * - "/ur/..."  -> served as-is
 * - "/en/..."  -> permanent redirect to the unprefixed URL (one canonical URL per page)
 * - anything else -> internally rewritten to "/en/..."
 */
export function resolveLocaleRoute(pathname: string): LocaleRoute {
  const [, first] = pathname.split("/");
  if (first === defaultLocale) {
    const stripped = pathname.slice(defaultLocale.length + 1) || "/";
    return { action: "redirect", pathname: stripped };
  }
  if (first && hasLocale(first)) return { action: "next" };
  return { action: "rewrite", pathname: `/${defaultLocale}${pathname === "/" ? "" : pathname}` };
}
