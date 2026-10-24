import "server-only";
import { refreshIfDue } from "./service";

const globalForRates = globalThis as unknown as { currencyRateTimer?: NodeJS.Timeout };

/**
 * Checks hourly whether exchange rates are due for a refresh (every 12 hours
 * by default, set in Admin → Payments → Currency). Started from
 * src/instrumentation.ts; a failure keeps the last known good rates.
 */
export function startRateLoop() {
  if (globalForRates.currencyRateTimer || process.env.CURRENCY_REFRESH === "off") return;
  const tick = () => {
    refreshIfDue()
      .then((r) => r && !r.ok && console.warn("[currency] rate refresh failed:", r.error))
      .catch((err) => console.warn("[currency] rate check failed:", err instanceof Error ? err.message : err));
  };
  setTimeout(tick, 45_000).unref();
  globalForRates.currencyRateTimer = setInterval(tick, 60 * 60_000);
  globalForRates.currencyRateTimer.unref();
}
