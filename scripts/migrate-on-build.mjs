// Runs `prisma migrate deploy` before `next build` so hosts with a fixed
// build command (e.g. Hostinger) create/update tables on every deploy.
//
// - Skipped when DATABASE_URL is unset or SKIP_DB_MIGRATE=1.
// - If the database is unreachable from the build machine, warns and lets
//   the build continue (run `npm run db:deploy` from somewhere that can reach it).
// - Any other migration failure fails the build.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

try {
  if (existsSync(".env")) process.loadEnvFile(".env");
} catch {}

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log("[migrate] SKIP_DB_MIGRATE=1, skipping database migrations.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL not set, skipping database migrations.");
  process.exit(0);
}

console.log("[migrate] Applying database migrations...");
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  encoding: "utf8",
  timeout: 120_000,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

if (result.status === 0) process.exit(0);

const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
const unreachable =
  timedOut || /P1001|P1002|P1017|Can't reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/i.test(output);
if (unreachable) {
  console.warn(
    "\n[migrate] WARNING: database not reachable from the build environment; migrations were NOT applied.\n" +
      "[migrate] The build will continue. Apply them with `npm run db:deploy` where the database is reachable.\n",
  );
  process.exit(0);
}

console.error("[migrate] Migration failed; stopping the build.");
process.exit(1);
