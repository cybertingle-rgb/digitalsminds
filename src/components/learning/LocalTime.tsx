"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** "Your time: Tue 4 Nov, 3:30 pm" when the visitor's time zone differs from the batch's. Nothing on the server. */
export function LocalTime({ at, zone, label, locale }: { at: string; zone: string; label: string; locale: string }) {
  // The browser's zone is only known on the client; the server renders nothing.
  const mine = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
  if (!mine) return null;
  const d = new Date(at);
  const fmt = (tz: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
  const text = fmt(mine);
  // Only worth showing when the clock reads differently.
  if (text === fmt(zone)) return null;
  return (
    <span className="block text-xs text-muted">
      {label}: <span dir="ltr">{text}</span>
    </span>
  );
}
