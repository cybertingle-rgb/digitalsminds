"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * After a deploy, a page that was already open still runs the previous
 * version's code: its buttons call server actions (and load files) that no
 * longer exist. Reloading picks up the new version.
 */
export function isStaleDeployment(error: unknown): boolean {
  if (unstable_isUnrecognizedActionError(error)) return true;
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Server Action .* was not found on the server|ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(msg);
}

const KEY = "dm-stale-reload";

/** Reloads the page, at most once a minute so a real error can never cause a reload loop. Returns false if it didn't. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload; the browser's own state stops a loop.
  }
  window.location.reload();
  return true;
}
