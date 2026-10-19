import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * Renders the official logo from /public/brand once configured in
 * siteConfig.logo; until then shows the brand name as plain text.
 */
export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  const { logo, name } = siteConfig;
  return (
    <Link href="/" className="inline-flex items-center" aria-label={`${name} home`}>
      {logo ? (
        <Image src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} priority className="h-10 w-auto" />
      ) : (
        <span className={`text-xl font-bold tracking-tight ${inverse ? "text-white" : "text-brand-900"}`}>{name}</span>
      )}
    </Link>
  );
}
