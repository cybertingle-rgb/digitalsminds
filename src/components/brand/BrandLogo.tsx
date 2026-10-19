import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  alt: string;
  homeLabel: string;
  /** "light" = dark lettering for light backgrounds; "dark" = official dark-background logo. */
  variant?: "light" | "dark";
  className?: string;
  priority?: boolean;
};

/** Official Digitals Minds logo, used exactly as supplied. */
export function BrandLogo({ locale, alt, homeLabel, variant = "light", className = "h-12 w-auto", priority }: Props) {
  const logo = siteConfig.logo[variant];
  return (
    <Link href={localizePath("/", locale)} className="inline-flex shrink-0 items-center" aria-label={homeLabel}>
      <Image src={logo.src} alt={alt} width={logo.width} height={logo.height} priority={priority} className={className} />
    </Link>
  );
}
