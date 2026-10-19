import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .refine((v) => /^(mysql|mariadb):\/\//.test(v), "DATABASE_URL must be a MySQL connection string (mysql://...)"),
  INQUIRY_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  // Account-related secrets are validated where they are used (authSecret(),
  // setupCodeConfigured()) so a missing or short value only disables
  // login/admin, never the public site, contact form or database access.
  /** Signs sessions and derives the key that encrypts stored integration secrets. Never change it once live. */
  BETTER_AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  /** One-time code for /setup (creating the first Super Admin). Remove after setup. */
  ADMIN_SETUP_CODE: z.preprocess(emptyToUndefined, z.string().optional()),
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

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Accounts are not configured: set BETTER_AUTH_SECRET (at least 32 random characters) in the hosting environment.");
    this.name = "AuthNotConfiguredError";
  }
}

/** True when BETTER_AUTH_SECRET is set and long enough for accounts to work. */
export function isAuthConfigured(): boolean {
  return (serverEnv().BETTER_AUTH_SECRET?.length ?? 0) >= 32;
}

/** The auth secret; throws AuthNotConfiguredError if it is missing or too short. */
export function authSecret(): string {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new AuthNotConfiguredError();
  return secret;
}
