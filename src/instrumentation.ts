/** Runs once when the server starts (not during the build). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  // Without a database there is nothing to remind about (e.g. a static preview).
  if (!process.env.DATABASE_URL) return;
  const { startReminderLoop } = await import("@/modules/live/scheduler");
  startReminderLoop();
}
