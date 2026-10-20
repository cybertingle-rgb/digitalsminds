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
    <div className="xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-charcoal-900 hover:bg-white/70"
      >
        <span className="sr-only">{open ? labels.close : labels.open}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-white bg-white p-3 pb-4 shadow-xl">
          <nav aria-label={labels.nav}>
            <NavLinks items={items} homeHref={homeHref} vertical onNavigate={() => setOpen(false)} />
          </nav>
          {extra && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-charcoal-200/60 pt-3" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
              {extra}
            </div>
          )}
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
