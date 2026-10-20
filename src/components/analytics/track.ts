/**
 * Google Analytics helpers (browser only). Nothing is sent unless the visitor
 * accepted analytics cookies and a Measurement ID is set: before that,
 * window.gtag does not exist and track() does nothing. Never pass personal
 * details (names, emails, messages) as event parameters.
 */

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export const CONSENT_KEY = "dm_consent";
export const COOKIE_SETTINGS_EVENT = "dm:cookie-settings";

export type ConsentChoice = "granted" | "denied";

export function readConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

export function track(event: "generate_lead" | "sign_up" | "enrollment_request", params?: Record<string, string>) {
  window.gtag?.("event", event, params ?? {});
}

/** Loads gtag.js with Consent Mode: everything denied by default, analytics granted by this call. */
export function loadAnalytics(gaId: string) {
  if (window.gtag) {
    window.gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the Arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", gaId);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(s);
}

/** Stops analytics and removes its cookies after the visitor withdraws consent. */
export function stopAnalytics() {
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  const host = location.hostname.replace(/^www\./, "");
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]!.trim();
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid") {
      for (const domain of ["", `; domain=${host}`, `; domain=.${host}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }
}
