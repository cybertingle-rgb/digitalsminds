"use client";

import { useEffect, useState } from "react";

/**
 * A slim brand-coloured bar at the top while an in-site page change takes
 * longer than a moment (the full preloader is only for the first visit).
 * It clears as soon as the address changes, and gives up after 10 seconds
 * so a failed request never leaves it running.
 */
export function NavigationProgress({ label }: { label: string }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let show: ReturnType<typeof setTimeout> | undefined;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    let watch: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearTimeout(show);
      clearTimeout(giveUp);
      clearInterval(watch);
      setActive(false);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      stop();
      const from = location.href;
      show = setTimeout(() => setActive(true), 250);
      giveUp = setTimeout(stop, 10_000);
      // The new page has arrived once the address changes.
      watch = setInterval(() => {
        if (location.href !== from) stop();
      }, 100);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", stop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", stop);
      stop();
    };
  }, []);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label={label} className="dm-nav-progress pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px] overflow-hidden">
      <span className="block h-full w-1/3 rounded-full bg-gradient-to-r from-sun-200 via-sun-400 to-charcoal-900" />
    </div>
  );
}
