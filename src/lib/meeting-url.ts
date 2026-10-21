import { z } from "zod";

const MEETING_HOSTS = /^(([a-z0-9-]+\.)*zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)$/;

/** True for a full https:// Zoom, Google Meet or Teams link. */
export function isMeetingUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && MEETING_HOSTS.test(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const meetingUrlSchema = z.string().trim().max(500).refine(isMeetingUrl, "Paste the full https:// Zoom, Google Meet or Teams link");
