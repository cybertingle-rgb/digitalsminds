/**
 * Brand identity, navigation and public contact details. Visible text lives
 * in the dictionaries (src/i18n/dictionaries); this file holds structure,
 * URLs and assets.
 *
 * Phone numbers are intentionally not shown anywhere on the site (owner
 * decision). Do not add one without approval.
 */

export const siteConfig = {
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),

  /** Official logos supplied by Digitals Minds (originals in assets/brand/originals). */
  logo: {
    light: { src: "/brand/logo.png", width: 720, height: 349 },
    dark: { src: "/brand/logo-on-dark.png", width: 720, height: 350 },
  },
  ogImage: { src: "/brand/og-image.png", width: 1200, height: 630 },

  /**
   * The owner's Super Admin account. It can only be created through the
   * one-time /setup page (protected by ADMIN_SETUP_CODE), never by sign-up.
   */
  superAdminEmail: "info@digitalsminds.com",

  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "info@digitalsminds.com",
  },

  /** Add profile URLs here to show them in the footer. */
  social: [] as { label: string; href: string }[],

  /** `key` refers to dict.nav. */
  nav: [
    { key: "home", href: "/" },
    { key: "about", href: "/about" },
    { key: "services", href: "/services" },
    { key: "courses", href: "/courses" },
    { key: "blog", href: "/blog" },
    { key: "contact", href: "/contact" },
  ] as const,

  primaryCtaHref: "/contact",
} as const;

export type NavKey = (typeof siteConfig.nav)[number]["key"];
