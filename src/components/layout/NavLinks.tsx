"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPathname } from "@/i18n/config";

export type NavItem = { label: string; href: string };

/** `href` is already localized ("/about" or "/ur/about"); home is "/" or "/ur". */
export function isActive(pathname: string, href: string, homeHref: string) {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = { items: NavItem[]; homeHref: string; onNavigate?: () => void; vertical?: boolean };

export function NavLinks({ items, homeHref, onNavigate, vertical = false }: Props) {
  // Normalised: English pages are rendered at "/en/..." on the server but shown at "/..." in the browser.
  const pathname = publicPathname(usePathname());
  return (
    <ul className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {items.map((item) => {
        const active = isActive(pathname, item.href, homeHref);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative block rounded-xl font-semibold transition-all duration-300 ${
                vertical
                  ? `px-4 py-3 text-base ${active ? "bg-gradient-to-r from-sun-100 to-white text-charcoal-900 shadow-[inset_3px_0_0_var(--color-sun-400)] rtl:shadow-[inset_-3px_0_0_var(--color-sun-400)]" : "text-charcoal-700 hover:bg-sun-50"}`
                  : `px-4 py-2.5 text-[15px] after:absolute after:inset-x-4 after:bottom-1 after:h-0.5 after:origin-center after:rounded-full after:bg-sun-400 after:transition-transform after:duration-300 ${
                      active
                        ? "bg-gradient-to-b from-white to-sun-50 text-charcoal-900 shadow-[0_0_0_1px_rgb(253_207_49/0.45),0_10px_26px_-10px_rgb(244_192_26/0.85)] after:scale-x-100"
                        : "text-charcoal-700 after:scale-x-0 hover:-translate-y-px hover:bg-white/80 hover:text-charcoal-900 hover:shadow-[0_0_0_1px_rgb(253_207_49/0.3),0_10px_30px_-8px_rgb(253_207_49/0.75)] hover:after:scale-x-100"
                    }`
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
