import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { serverEnv } from "./env";

/**
 * Encryption for secrets stored in the database (SMTP password, Google client
 * secret). AES-256-GCM with a key derived from BETTER_AUTH_SECRET via HKDF, so
 * the database alone is not enough to read them.
 *
 * Format: "v1.<iv>.<authTag>.<ciphertext>" (base64url parts).
 */

const VERSION = "v1";

function key(secret = serverEnv().BETTER_AUTH_SECRET): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "digitalsminds", "settings-encryption-v1", 32));
}

export function encryptSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Throws if the value was tampered with or encrypted under a different secret. */
export function decryptSecret(token: string, secret?: string): string {
  const [version, iv, tag, data] = token.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
