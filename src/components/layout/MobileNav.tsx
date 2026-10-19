"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LinkButton } from "@/components/ui/Button";
import { NavLinks, type NavItem } from "./NavLinks";

type Props = {
  items: NavItem[];
  homeHref: string;
  cta: NavItem;
  labels: { open: string; close: string; nav: string };
  extra?: ReactNode;
};

export function MobileNav({ items, homeHref, cta, labels, extra }: Props) {
  const [open, setOpen] = useState(false);

  // Links close the menu via onNavigate; Escape closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-charcoal-900 hover:bg-charcoal-50"
      >
        <span className="sr-only">{open ? labels.close : labels.open}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b border-line bg-white px-4 pb-6 pt-2 shadow-lg">
          <nav aria-label={labels.nav}>
            <NavLinks items={items} homeHref={homeHref} vertical onNavigate={() => setOpen(false)} />
          </nav>
          {extra && <div className="mt-4 border-t border-line pt-4">{extra}</div>}
          <div onClick={() => setOpen(false)}>
            <LinkButton href={cta.href} className="mt-4 w-full">
              {cta.label}
            </LinkButton>
          </div>
        </div>
      )}
    </div>
  );
}
