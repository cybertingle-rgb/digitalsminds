import "server-only";
import { sendDueReminders } from "./service";

const globalForLive = globalThis as unknown as { liveReminderTimer?: NodeJS.Timeout };

/**
 * Checks for due live-class reminders every few minutes inside the running
 * server (started from src/instrumentation.ts). Reminders are claimed in the
 * database, so a restart or a second process never sends one twice.
 */
export function startReminderLoop() {
  if (globalForLive.liveReminderTimer) return;
  const every = Math.max(30_000, Number(process.env.LIVE_REMINDER_INTERVAL_MS) || 5 * 60_000);
  const tick = () => {
    sendDueReminders().catch((err) => console.warn("[live] reminder check failed:", err instanceof Error ? err.message : err));
  };
  setTimeout(tick, 20_000).unref();
  globalForLive.liveReminderTimer = setInterval(tick, every);
  globalForLive.liveReminderTimer.unref();
}
