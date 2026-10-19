/**
 * Single source of truth for brand identity, navigation and public contact
 * channels. Change copy or links here, not in components.
 */

const optional = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const siteConfig = {
  name: "Digitals Minds",
  tagline: "Learn | Grow | Earn",
  taglineParts: ["Learn", "Grow", "Earn"] as const,
  positioning: "A Complete Business Growth & Brand Development Initiative",
  description:
    "Digitals Minds is a complete business growth and brand development initiative: digital marketing, product sourcing, media production, startup setup and web & e-commerce under one roof.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),

  /**
   * Official logo. Leave `null` until the official files are added to
   * /public/brand (see public/brand/README.md); the header/footer then show
   * the brand name as plain text. Do not substitute a made-up logo.
   *
   * Example once added:
   *   logo: { src: "/brand/logo.svg", alt: "Digitals Minds", width: 180, height: 48 },
   */
  logo: null as null | { src: string; alt: string; width: number; height: number },

  contact: {
    email: optional(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
    phone: optional(process.env.NEXT_PUBLIC_CONTACT_PHONE),
    whatsapp: optional(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER)?.replace(/\D/g, ""),
  },

  /** Add profile URLs here to show them in the footer. */
  social: [] as { label: string; href: string }[],

  nav: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ],

  primaryCta: { label: "Start a Project", href: "/contact" },
} as const;

export type SiteConfig = typeof siteConfig;
