"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { label: string; href: string };

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items, onNavigate, vertical = false }: { items: readonly Item[]; onNavigate?: () => void; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-surface-alt hover:text-ink"
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
