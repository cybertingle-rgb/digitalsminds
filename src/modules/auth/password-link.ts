import "server-only";
import { randomUUID } from "node:crypto";
import { siteConfig } from "@/config/site";
import { getAuth } from "@/lib/auth";

/**
 * A one-time "set your password" link for an account created by staff or by
 * enrollment. It uses Better Auth's own reset-token storage, so the normal
 * /reset-password page sets the password (and marks the email verified).
 */
export async function passwordSetupUrl(userId: string, ttlSeconds: number) {
  const ctx = await (await getAuth()).$context;
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });
  return `${siteConfig.url}/reset-password?token=${token}`;
}
