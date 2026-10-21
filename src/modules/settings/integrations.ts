import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

/**
 * Integration credentials managed from Admin → Integrations. Secrets are
 * encrypted at rest (src/lib/secrets.ts) and never sent back to the browser.
 */

const KEYS = { google: "integration.google", smtp: "integration.smtp" } as const;

const googleStored = z.object({
  clientId: z.string(),
  clientSecretEnc: z.string(),
  /** Show "Sign in with Google" on login/register pages. */
  enabled: z.boolean(),
  /** Set when an admin completed a real Google sign-in with these credentials. */
  verifiedAt: z.string().nullable(),
  updatedAt: z.string(),
});
type GoogleStored = z.infer<typeof googleStored>;

const smtpStored = z.object({
  host: z.string(),
  port: z.number(),
  secure: z.boolean(),
  username: z.string(),
  passwordEnc: z.string(),
  fromName: z.string(),
  fromEmail: z.string(),
  verifiedAt: z.string().nullable(),
  updatedAt: z.string(),
});
type SmtpStored = z.infer<typeof smtpStored>;

async function read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  const row = await db().siteSetting.findUnique({ where: { key } });
  if (!row) return null;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
}

async function write(key: string, value: object, actorId: string | null) {
  await db().siteSetting.upsert({
    where: { key },
    create: { key, value, updatedById: actorId },
    update: { value, updatedById: actorId },
  });
}

export const UNREADABLE_SMTP = "The saved mailbox password can no longer be read. Type the mailbox password again, then save.";
export const UNREADABLE_GOOGLE = "The saved Client Secret can no longer be read. Paste the Client Secret again, then save.";

function readable(token: string): boolean {
  try {
    decryptSecret(token);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export const googleCredentialsInput = z.object({
  clientId: z
    .string()
    .trim()
    .max(255)
    .regex(/^[\w.-]+\.apps\.googleusercontent\.com$/, "This doesn't look like a Google OAuth Client ID (it ends with .apps.googleusercontent.com)"),
  /** Empty = keep the saved secret. */
  clientSecret: z.string().trim().max(255).optional(),
});

export type GoogleStatus = {
  configured: boolean;
  /** False if the saved secret can't be decrypted (BETTER_AUTH_SECRET changed): re-enter it. */
  secretReadable: boolean;
  clientId: string | null;
  enabled: boolean;
  verifiedAt: string | null;
  updatedAt: string | null;
};

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const g = await read(KEYS.google, googleStored);
  return {
    configured: !!g,
    secretReadable: !!g && readable(g.clientSecretEnc),
    clientId: g?.clientId ?? null,
    enabled: !!g?.enabled && !!g?.verifiedAt,
    verifiedAt: g?.verifiedAt ?? null,
    updatedAt: g?.updatedAt ?? null,
  };
}

/** Decrypted credentials for building the auth provider. Server only. */
export async function getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string; updatedAt: string } | null> {
  const g = await read(KEYS.google, googleStored);
  if (!g) return null;
  try {
    return { clientId: g.clientId, clientSecret: decryptSecret(g.clientSecretEnc), updatedAt: g.updatedAt };
  } catch {
    console.error("[integrations] Google client secret could not be decrypted (was BETTER_AUTH_SECRET changed?)");
    return null;
  }
}

export async function saveGoogleCredentials(input: z.infer<typeof googleCredentialsInput>, actorId: string) {
  const existing = await read(KEYS.google, googleStored);
  if (!input.clientSecret && !existing) throw new Error("Client Secret is required");
  if (!input.clientSecret && !readable(existing!.clientSecretEnc)) throw new Error(UNREADABLE_GOOGLE);
  const changed = !existing || existing.clientId !== input.clientId || !!input.clientSecret;
  const value: GoogleStored = {
    clientId: input.clientId,
    clientSecretEnc: input.clientSecret ? encryptSecret(input.clientSecret) : existing!.clientSecretEnc,
    // New credentials must be tested again before students see the button.
    enabled: changed ? false : existing!.enabled,
    verifiedAt: changed ? null : existing!.verifiedAt,
    updatedAt: new Date().toISOString(),
  };
  await write(KEYS.google, value, actorId);
}

export async function markGoogleVerified(actorId: string) {
  const g = await read(KEYS.google, googleStored);
  if (!g) return;
  await write(KEYS.google, { ...g, verifiedAt: new Date().toISOString() }, actorId);
}

export async function setGoogleEnabled(enabled: boolean, actorId: string) {
  const g = await read(KEYS.google, googleStored);
  if (!g) throw new Error("Google is not configured");
  if (enabled && !g.verifiedAt) throw new Error("Connect & test Google before enabling it for students");
  await write(KEYS.google, { ...g, enabled }, actorId);
}

export async function removeGoogle() {
  await db().siteSetting.deleteMany({ where: { key: KEYS.google } });
}

// ---------------------------------------------------------------------------
// Email (SMTP)
// ---------------------------------------------------------------------------

export const smtpInput = z.object({
  host: z.string().trim().min(3).max(255).regex(/^[a-zA-Z0-9.-]+$/, "Enter a host name, e.g. smtp.hostinger.com"),
  port: z.coerce.number().int().min(1).max(65535),
  /** true = SSL/TLS (usually port 465); false = STARTTLS (usually 587). */
  secure: z.coerce.boolean(),
  username: z.string().trim().min(3).max(254),
  /** Empty = keep the saved password. */
  password: z.string().max(255).optional(),
  fromName: z.string().trim().min(1).max(80).regex(/^[^\r\n<>"]+$/, "Name cannot contain line breaks, quotes or < >"),
  fromEmail: z.email("Enter a valid sender email").max(254),
});

export type SmtpStatus = {
  configured: boolean;
  /** False if the saved password can't be decrypted (BETTER_AUTH_SECRET changed): re-enter it. */
  secretReadable: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromName: string | null;
  fromEmail: string | null;
  verifiedAt: string | null;
};

export async function getSmtpStatus(): Promise<SmtpStatus> {
  const s = await read(KEYS.smtp, smtpStored);
  return {
    configured: !!s,
    secretReadable: !!s && readable(s.passwordEnc),
    host: s?.host ?? null,
    port: s?.port ?? null,
    secure: s?.secure ?? true,
    username: s?.username ?? null,
    fromName: s?.fromName ?? null,
    fromEmail: s?.fromEmail ?? null,
    verifiedAt: s?.verifiedAt ?? null,
  };
}

export type SmtpConfig = Omit<SmtpStored, "passwordEnc" | "verifiedAt" | "updatedAt"> & { password: string };

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const s = await read(KEYS.smtp, smtpStored);
  if (!s) return null;
  try {
    return { host: s.host, port: s.port, secure: s.secure, username: s.username, password: decryptSecret(s.passwordEnc), fromName: s.fromName, fromEmail: s.fromEmail };
  } catch {
    console.error("[integrations] SMTP password could not be decrypted (was BETTER_AUTH_SECRET changed?)");
    return null;
  }
}

export async function saveSmtp(input: z.infer<typeof smtpInput>, actorId: string) {
  const existing = await read(KEYS.smtp, smtpStored);
  if (!input.password && !existing) throw new Error("Password is required");
  if (!input.password && !readable(existing!.passwordEnc)) throw new Error(UNREADABLE_SMTP);
  const value: SmtpStored = {
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    passwordEnc: input.password ? encryptSecret(input.password) : existing!.passwordEnc,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    verifiedAt: null,
    updatedAt: new Date().toISOString(),
  };
  await write(KEYS.smtp, value, actorId);
}

export async function markSmtpVerified(actorId: string) {
  const s = await read(KEYS.smtp, smtpStored);
  if (s) await write(KEYS.smtp, { ...s, verifiedAt: new Date().toISOString() }, actorId);
}
