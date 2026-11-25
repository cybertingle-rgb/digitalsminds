// Runs `prisma migrate deploy` before `next build` so hosts with a fixed
// build command (e.g. Hostinger) create/update tables on every deploy.
//
// - Skipped when DATABASE_URL is unset or SKIP_DB_MIGRATE=1.
// - If the database is unreachable from the build machine, warns and lets
//   the build continue (run `npm run db:deploy` from somewhere that can reach it).
// - Some hosts won't run Prisma's schema-engine binary (e.g. "spawn ... EACCES" on
//   Hostinger). Then the pending migration.sql files are applied directly through the
//   MariaDB driver the app already uses, and recorded in Prisma's own _prisma_migrations
//   table exactly as `prisma migrate deploy` would, so either tool can be used later.
// - A migration whose SQL fails still fails the build (a half-migrated database must be
//   looked at, not built over).
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

const UNREACHABLE = /P1001|P1002|P1017|Can't reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/i;

function warnUnreachable() {
  console.warn(
    "\n[migrate] WARNING: database not reachable from the build environment; migrations were NOT applied.\n" +
      "[migrate] The build will continue. Apply them with `npm run db:deploy` where the database is reachable.\n",
  );
  process.exit(0);
}

// Installs sometimes drop the executable bit on Prisma's engine binaries; put it back if we may.
const enginesDir = "node_modules/@prisma/engines";
if (existsSync(enginesDir)) {
  for (const f of readdirSync(enginesDir)) {
    if (f.startsWith("schema-engine")) {
      try {
        chmodSync(path.join(enginesDir, f), 0o755);
      } catch {}
    }
  }
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
if (timedOut || UNREACHABLE.test(output)) warnUnreachable();

// The engine itself couldn't start (not a problem with a migration).
const engineBroken = /EACCES|ENOEXEC|EPERM|schema[- ]engine/i.test(output) && !/P3\d{3}|Database error|failed to apply/i.test(output);
if (!engineBroken) {
  console.error("[migrate] Migration failed; stopping the build.");
  process.exit(1);
}

console.warn("[migrate] Prisma's schema engine can't run here; applying migrations through the database driver instead.");
try {
  await applyWithDriver();
  process.exit(0);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (UNREACHABLE.test(msg) || /ECONNRESET|ER_ACCESS_DENIED|connect/i.test(msg)) warnUnreachable();
  console.error(`[migrate] ${msg}\n[migrate] Migration failed; stopping the build.`);
  process.exit(1);
}

async function applyWithDriver() {
  const { default: mariadb } = await import("mariadb");
  const u = new URL(process.env.DATABASE_URL);
  const config = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    multipleStatements: true,
    connectTimeout: 20_000,
  };
  // Same driver options in the URL that the app honours (e.g. ?ssl=true).
  for (const [key, value] of u.searchParams) {
    if (key === "connectionLimit") continue;
    config[key] = /^\d+$/.test(value) ? Number(value) : value === "true" ? true : value === "false" ? false : value;
  }
  const conn = await mariadb.createConnection(config);
  try {
    await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    // Prisma's own bookkeeping table, created the way Prisma creates it.
    await conn.query(
      "CREATE TABLE IF NOT EXISTS `_prisma_migrations` (" +
        "`id` VARCHAR(36) NOT NULL, `checksum` VARCHAR(64) NOT NULL, `finished_at` DATETIME(3) NULL, " +
        "`migration_name` VARCHAR(255) NOT NULL, `logs` TEXT NULL, `rolled_back_at` DATETIME(3) NULL, " +
        "`started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0, " +
        "PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    const rows = await conn.query("SELECT `migration_name`, `finished_at`, `rolled_back_at` FROM `_prisma_migrations`");
    const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at).map((r) => r.migration_name);
    if (failed.length) {
      throw new Error(`An earlier migration did not finish (${failed.join(", ")}). Fix it and mark it with \`prisma migrate resolve\` first.`);
    }
    const done = new Set(rows.filter((r) => r.finished_at).map((r) => r.migration_name));
    const dir = "prisma/migrations";
    const pending = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "migration.sql")) && !done.has(d.name))
      .map((d) => d.name)
      .sort();
    if (pending.length === 0) {
      console.log("[migrate] No pending migrations.");
      return;
    }
    for (const name of pending) {
      const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const id = randomUUID();
      const checksum = createHash("sha256").update(sql).digest("hex");
      await conn.query("INSERT INTO `_prisma_migrations` (`id`, `checksum`, `migration_name`, `started_at`) VALUES (?, ?, ?, NOW(3))", [id, checksum, name]);
      try {
        if (sql.trim()) await conn.query(sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await conn.query("UPDATE `_prisma_migrations` SET `logs` = ? WHERE `id` = ?", [msg, id]).catch(() => {});
        throw new Error(`Migration ${name} failed: ${msg}`);
      }
      await conn.query("UPDATE `_prisma_migrations` SET `finished_at` = NOW(3), `applied_steps_count` = 1 WHERE `id` = ?", [id]);
      console.log(`[migrate] Applied ${name}`);
    }
    console.log(`[migrate] ${pending.length} migration(s) applied.`);
  } finally {
    await conn.end();
  }
}
