"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COOKIE_SETTINGS_EVENT, loadAnalytics, readConsent, saveConsent, stopAnalytics, type ConsentChoice } from "./track";

type Labels = { title: string; text: string; accept: string; decline: string; privacy: string };

/**
 * Cookie banner. Asks once when Google Analytics is set up (Admin → Website →
 * Analytics); "Cookie settings" in the footer reopens it at any time. Without
 * a Measurement ID only essential cookies exist, so it stays hidden unless
 * the visitor opens it.
 */
export function CookieConsent({ gaId, labels, privacyHref }: { gaId: string | null; labels: Labels; privacyHref: string }) {
  // "visible" asks quietly on a first visit; "focused" was opened from Cookie settings.
  const [open, setOpen] = useState<false | "visible" | "focused">(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const choice = readConsent();
    if (gaId && choice === "granted") loadAnalytics(gaId);
    // Asking is a reaction to stored state that only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (gaId && choice === null) setOpen("visible");
    const reopen = () => setOpen("focused");
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, [gaId]);

  useEffect(() => {
    if (open === "focused") panel.current?.focus();
  }, [open]);

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    if (choice === "granted" && gaId) loadAnalytics(gaId);
    if (choice === "denied") stopAnalytics();
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div
      ref={panel}
      role="region"
      aria-label={labels.title}
      tabIndex={-1}
      className="glass-strong fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl p-5 shadow-xl outline-none sm:bottom-5 print:hidden"
    >
      <p className="font-semibold text-charcoal-900">{labels.title}</p>
      <p className="mt-1 text-sm text-charcoal-700">
        {labels.text}{" "}
        <Link href={privacyHref} className="font-medium text-charcoal-900 underline underline-offset-4">
          {labels.privacy}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("granted")} className="rounded-full bg-charcoal-900 px-5 py-2 text-sm font-semibold text-white hover:bg-charcoal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500">
          {labels.accept}
        </button>
        <button type="button" onClick={() => choose("denied")} className="rounded-full border border-charcoal-300 bg-white/70 px-5 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500">
          {labels.decline}
        </button>
      </div>
    </div>
  );
}

/** Footer link that reopens the cookie banner. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      {label}
    </button>
  );
}
