"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPathname } from "@/i18n/config";

/** Sub-navigation within an admin section. The first item matches only exactly. */
export function AdminTabs({ items, label }: { items: { label: string; href: string }[]; label: string }) {
  const pathname = publicPathname(usePathname());
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex gap-1.5 pb-1">
        {items.map((t, i) => {
          const active = i === 0 ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800 hover:bg-white/80"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
