"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPathname } from "@/i18n/config";

export function AdminNav({ items }: { items: { label: string; href: string }[] }) {
  const pathname = publicPathname(usePathname());
  return (
    <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:pb-0">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-sun-400 text-charcoal-900 shadow-[0_6px_16px_-8px_rgb(244_192_26/0.9)]" : "text-charcoal-700 hover:bg-white/75 hover:text-charcoal-900"
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
