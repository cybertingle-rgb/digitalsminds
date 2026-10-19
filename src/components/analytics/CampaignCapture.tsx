"use client";

import { useEffect } from "react";

const KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
export const CAMPAIGN_STORAGE_KEY = "dm_campaign";

/**
 * Remembers utm_* parameters from the landing URL for this browser tab only
 * (sessionStorage, no cookies), so an inquiry sent later in the visit can be
 * attributed to the campaign that brought the visitor.
 */
export function CampaignCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!KEYS.some((k) => params.get(k))) return;
      const campaign = Object.fromEntries(KEYS.map((k) => [k, (params.get(k) ?? "").slice(0, 150)]));
      sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign));
    } catch {
      // Storage blocked (private mode etc.): attribution is optional.
    }
  }, []);
  return null;
}

export function readCampaign(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  try {
    const c = JSON.parse(sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) ?? "null");
    if (!c) return {};
    return { utmSource: c.utm_source || undefined, utmMedium: c.utm_medium || undefined, utmCampaign: c.utm_campaign || undefined };
  } catch {
    return {};
  }
}
