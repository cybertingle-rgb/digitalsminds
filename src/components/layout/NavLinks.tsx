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
              className={`relative block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? vertical
                    ? "bg-sun-50 text-charcoal-900 shadow-[inset_3px_0_0_var(--color-sun-400)] rtl:shadow-[inset_-3px_0_0_var(--color-sun-400)]"
                    : "text-charcoal-900"
                  : "text-muted hover:bg-charcoal-50 hover:text-charcoal-900"
              }`}
            >
              {item.label}
              {active && !vertical && (
                <span aria-hidden="true" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-sun-400" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
