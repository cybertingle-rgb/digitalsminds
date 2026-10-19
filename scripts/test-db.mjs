// Runs the database integration tests against TEST_DATABASE_URL.
// Safety: refuses to run unless the database name contains "test", and
// only applies migrations (never resets or drops anything).
import { spawnSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Set TEST_DATABASE_URL to a disposable MySQL database whose name contains 'test'.");
  process.exit(1);
}
const dbName = new URL(url).pathname.slice(1);
if (!/test/i.test(dbName)) {
  console.error(`Refusing to run: database "${dbName}" does not look like a test database.`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };
const run = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env }).status ?? 1;

if (run(["node_modules/prisma/build/index.js", "migrate", "deploy"]) !== 0) process.exit(1);
process.exit(run(["node_modules/vitest/vitest.mjs", "run", "src/test/"]));
