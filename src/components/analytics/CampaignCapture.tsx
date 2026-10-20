"use client";

/** Set by CAMPAIGN_HEAD_SCRIPT (campaign-script.ts). */
export const CAMPAIGN_STORAGE_KEY = "dm_campaign";

export function readCampaign(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  try {
    const c = JSON.parse(sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) ?? "null");
    if (!c) return {};
    return { utmSource: c.utm_source || undefined, utmMedium: c.utm_medium || undefined, utmCampaign: c.utm_campaign || undefined };
  } catch {
    return {};
  }
}
