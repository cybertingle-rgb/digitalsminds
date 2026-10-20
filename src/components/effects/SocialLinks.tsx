"use client";

import { useEffect, useState } from "react";
import { socialLabels, type SocialPlatform } from "@/modules/settings/social-types";
import { SocialIcon } from "./SocialIcon";

type Link = { platform: SocialPlatform; href: string };

let cache: Promise<Link[]> | null = null;
/** One request per page view, shared by the rail and the footer. */
function loadLinks() {
  cache ??= fetch("/api/public/social")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return cache;
}

function useSocialLinks() {
  const [links, setLinks] = useState<Link[]>([]);
  useEffect(() => {
    let alive = true;
    loadLinks().then((l) => alive && setLinks(l));
    return () => {
      alive = false;
    };
  }, []);
  return links;
}

/**
 * Floating social icons on the right edge (tablet and desktop). Each one
 * expands to show its name on hover, with a light running around the border.
 */
export function SocialRail({ label }: { label: string }) {
  const links = useSocialLinks();
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className="fixed end-1.5 top-1/2 z-30 hidden -translate-y-1/2 md:block">
      <ul className="flex flex-col items-end gap-2.5">
        {links.map((l) => (
          <li key={l.platform}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={socialLabels[l.platform]}
              className="glass-blur border-run group flex h-11 w-11 items-center justify-end overflow-hidden rounded-full text-charcoal-900 transition-[width,box-shadow,background] duration-300 ease-out hover:w-40 hover:shadow-[0_0_0_1px_rgb(253_207_49/0.4),0_12px_30px_-8px_rgb(253_207_49/0.8)] focus-visible:w-40"
            >
              <span className="whitespace-nowrap ps-4 text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {socialLabels[l.platform]}
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center transition-colors group-hover:text-gold-700">
                <SocialIcon platform={l.platform} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Row of round social buttons (footer, and the only place they show on phones). */
export function SocialRow({ label }: { label: string }) {
  const links = useSocialLinks();
  if (links.length === 0) return null;
  return (
    <ul aria-label={label} className="mt-5 flex gap-2">
      {links.map((l) => (
        <li key={l.platform}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={socialLabels[l.platform]}
            className="border-run flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-charcoal-900 ring-1 ring-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sun-400 hover:shadow-[0_10px_24px_-8px_rgb(244_192_26/0.9)]"
          >
            <SocialIcon platform={l.platform} />
          </a>
        </li>
      ))}
    </ul>
  );
}
