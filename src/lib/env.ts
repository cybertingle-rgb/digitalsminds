import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .refine((v) => /^(mysql|mariadb):\/\//.test(v), "DATABASE_URL must be a MySQL connection string (mysql://...)"),
  INQUIRY_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  /** Signs sessions and derives the key that encrypts stored integration secrets. Never change it once live. */
  BETTER_AUTH_SECRET: z
    .string({ error: "BETTER_AUTH_SECRET is required (at least 32 random characters)" })
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  /** One-time code for /setup (creating the first Super Admin). Remove after setup. */
  ADMIN_SETUP_CODE: z.preprocess(emptyToUndefined, z.string().min(16, "ADMIN_SETUP_CODE must be at least 16 characters").optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Validated server-only environment. Parsed lazily so `next build` does not
 * need database credentials; the first request that needs them fails loudly
 * with a clear message instead of a cryptic driver error.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
