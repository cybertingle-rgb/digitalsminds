import { defineConfig } from "prisma/config";

// Load .env for local CLI use without adding a dotenv dependency.
// On hosts that inject env vars directly, a missing .env file is fine.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
