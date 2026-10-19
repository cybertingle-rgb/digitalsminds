"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { publicPathname } from "@/i18n/config";

export function AdminNav({ items }: { items: { label: string; href: string }[] }) {
  const pathname = publicPathname(usePathname());
  return (
    <ul className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-sun-400 text-charcoal-900" : "text-charcoal-200 hover:bg-white/10 hover:text-white"
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
