import localFont from "next/font/local";

/**
 * Noto Naskh Arabic (SIL Open Font License, see src/fonts/noto-naskh-arabic/OFL.txt),
 * Arabic-script subset, self-hosted. Not preloaded: browsers only download it
 * on pages that actually render Urdu text.
 */
export const naskh = localFont({
  src: [
    { path: "../fonts/noto-naskh-arabic/noto-naskh-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-naskh-arabic/noto-naskh-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/noto-naskh-arabic/noto-naskh-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-naskh",
  display: "swap",
  preload: false,
});
