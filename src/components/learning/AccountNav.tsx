"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { publicPathname } from "@/i18n/config";

export type AccountIcon = "dashboard" | "courses" | "live" | "checklist" | "documents" | "megaphone" | "certificates" | "bell" | "support" | "profile";
type Item = { label: string; href: string; badge?: string; icon: AccountIcon };

const paths: Record<AccountIcon, ReactNode> = {
  dashboard: <path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-4H4v4Zm10-16v4h6V4h-6Z" />,
  courses: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13V4Z" />,
  live: <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h9A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-9ZM16 10.5l4-2.5v8l-4-2.5" />,
  checklist: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  documents: <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6" />,
  megaphone: <path d="M4 10v4h3l7 4V6l-7 4H4Zm14-1a4 4 0 0 1 0 6" />,
  certificates: <path d="M12 3l2.4 1.8 3-.1.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.1L12 21l-2.4-1.8-3 .1-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .1L12 3Zm-3 9 2 2 4-4" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4" />,
  support: <path d="M4 5h16v11H9l-5 4V5Zm4 5h8M8 13h5" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
};

function Icon({ name }: { name: AccountIcon }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

/**
 * Student portal navigation: a vertical list in the sidebar (large screens)
 * and scrolling tabs on phones. `href`s are already localized.
 */
export function AccountNav({ items, label }: { items: Item[]; label: string }) {
  const pathname = publicPathname(usePathname());
  const isActive = (item: Item, i: number) => (i === 0 ? pathname === item.href : pathname.startsWith(item.href));
  return (
    <nav aria-label={label}>
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((item, i) => {
          const active = isActive(item, i);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-sun-400 text-charcoal-900 shadow-[0_8px_20px_-10px_rgb(244_192_26/0.9)]" : "text-charcoal-700 hover:bg-white/80 hover:text-charcoal-900"
                }`}
              >
                <Icon name={item.icon} />
                <span className="lg:flex-1">{item.label}</span>
                {item.badge && <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-charcoal-900 text-white" : "bg-sun-400 text-charcoal-900"}`}>{item.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
