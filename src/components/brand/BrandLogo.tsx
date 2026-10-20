import Image from "next/image";
import Link from "next/link";
import { localizePath, type Locale } from "@/i18n/config";
import { getLogos } from "@/modules/content/settings";

type Props = {
  locale: Locale;
  alt: string;
  homeLabel: string;
  /** "light" = dark lettering for light backgrounds; "dark" = official dark-background logo. */
  variant?: "light" | "dark";
  className?: string;
  priority?: boolean;
};

/** Digitals Minds logo: the official file, or the replacement uploaded in Admin → Website → Logo. */
export async function BrandLogo({ locale, alt, homeLabel, variant = "light", className = "h-12 w-auto", priority }: Props) {
  const logo = (await getLogos())[variant];
  return (
    <Link href={localizePath("/", locale)} className="inline-flex shrink-0 items-center" aria-label={homeLabel}>
      <Image src={logo.src} alt={alt} width={logo.width} height={logo.height} priority={priority} className={className} />
    </Link>
  );
}
