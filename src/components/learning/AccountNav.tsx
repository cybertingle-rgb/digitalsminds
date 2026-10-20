"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPathname } from "@/i18n/config";

/** Tabs across the student area. `href`s are already localized. */
export function AccountNav({ items, label }: { items: { label: string; href: string; badge?: string }[]; label: string }) {
  const pathname = publicPathname(usePathname());
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex gap-2 border-b border-charcoal-200/60">
        {items.map((item, i) => {
          const active = i === 0 ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? "border-sun-400 text-charcoal-900" : "border-transparent text-muted hover:text-charcoal-900"}`}
              >
                {item.label}
                {item.badge && <span className="rounded-full bg-sun-400 px-2 py-0.5 text-xs text-charcoal-900">{item.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
