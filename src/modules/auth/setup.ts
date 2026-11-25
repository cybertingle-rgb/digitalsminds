import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";

/**
 * One-time creation of the owner's Super Admin account (info@wedosell.com).
 * Proof of ownership is the ADMIN_SETUP_CODE set in Hostinger's environment, so
 * the account is trusted without an email (email sending is configured later,
 * from the admin panel).
 */

export const setupInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    password: z.string().min(10, "Password must be at least 10 characters").max(128),
    confirmPassword: z.string(),
    code: z.string().trim().min(1, "Enter the setup code"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export async function isSetupComplete(): Promise<boolean> {
  return (await db().user.count({ where: { role: "SUPER_ADMIN" } })) > 0;
}

const MIN_SETUP_CODE = 16;

export function setupCodeConfigured(): boolean {
  return (serverEnv().ADMIN_SETUP_CODE?.length ?? 0) >= MIN_SETUP_CODE;
}

/** Constant-time comparison (hash first so lengths match). */
export function codesMatch(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export type SetupResult = { ok: true } | { ok: false; error: string };

export async function createSuperAdmin(input: z.infer<typeof setupInput>): Promise<SetupResult> {
  const expected = serverEnv().ADMIN_SETUP_CODE;
  if (!expected || expected.length < MIN_SETUP_CODE) {
    return { ok: false, error: "Setup is disabled. Set ADMIN_SETUP_CODE (at least 16 characters) in the hosting environment." };
  }
  if (!codesMatch(input.code, expected)) return { ok: false, error: "The setup code is incorrect." };
  if (await isSetupComplete()) return { ok: false, error: "Setup has already been completed." };

  const email = siteConfig.superAdminEmail;
  const existing = await db().user.findUnique({ where: { email } });
  const userId = existing?.id ?? randomUUID().replace(/-/g, "");
  const password = await hashPassword(input.password);

  await db().$transaction(async (tx) => {
    if (existing) {
      // An earlier, unprivileged record with this email (should not happen: sign-up blocks it).
      await tx.user.update({ where: { id: userId }, data: { name: input.name, role: "SUPER_ADMIN", status: "ACTIVE", emailVerified: true } });
      await tx.account.deleteMany({ where: { userId, providerId: "credential" } });
    } else {
      await tx.user.create({
        data: { id: userId, name: input.name, email, emailVerified: true, role: "SUPER_ADMIN", googleEmail: email },
      });
    }
    await tx.account.create({
      data: { id: randomUUID().replace(/-/g, ""), userId, accountId: userId, providerId: "credential", password },
    });
    await tx.auditLog.create({ data: { actorId: userId, action: "setup.super_admin_created", entityType: "User", entityId: userId } });
  });
  return { ok: true };
}

/** The old owner address; an account still on it is moved to superAdminEmail. */
const LEGACY_OWNER_EMAIL = "info@digitalsminds.com";

export const ownerResetInput = z
  .object({
    password: z.string().min(10, "Password must be at least 10 characters").max(128),
    confirmPassword: z.string(),
    code: z.string().trim().min(1, "Enter the setup code"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/**
 * Owner password recovery when email can't be used (e.g. email sending isn't working).
 * Same proof of ownership as the first setup: the ADMIN_SETUP_CODE from the hosting
 * environment, which the owner adds only for this and removes afterwards. Only the owner's
 * password changes (and, if it is still on the old address, its email); every other
 * account and all data are left alone. Existing sessions of the owner are signed out.
 */
export async function resetOwnerPassword(input: z.infer<typeof ownerResetInput>): Promise<SetupResult> {
  const expected = serverEnv().ADMIN_SETUP_CODE;
  if (!expected || expected.length < MIN_SETUP_CODE) {
    return { ok: false, error: "Password recovery is disabled. Set ADMIN_SETUP_CODE (at least 16 characters) in the hosting environment." };
  }
  if (!codesMatch(input.code, expected)) return { ok: false, error: "The setup code is incorrect." };

  const email = siteConfig.superAdminEmail;
  let owner = await db().user.findUnique({ where: { email } });
  if (owner && owner.role !== "SUPER_ADMIN") {
    return { ok: false, error: `The account ${email} isn't the Super Admin. Ask your developer to check the accounts.` };
  }
  let moved = false;
  if (!owner) {
    const legacy = await db().user.findUnique({ where: { email: LEGACY_OWNER_EMAIL } });
    if (!legacy || legacy.role !== "SUPER_ADMIN") return { ok: false, error: "No owner account was found." };
    owner = legacy;
    moved = true;
  }
  const userId = owner.id;
  const password = await hashPassword(input.password);

  await db().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        emailVerified: true,
        ...(moved ? { email, googleEmail: owner.googleEmail === LEGACY_OWNER_EMAIL ? email : owner.googleEmail } : {}),
      },
    });
    const credential = await tx.account.findFirst({ where: { userId, providerId: "credential" } });
    if (credential) await tx.account.update({ where: { id: credential.id }, data: { password } });
    else await tx.account.create({ data: { id: randomUUID().replace(/-/g, ""), userId, accountId: userId, providerId: "credential", password } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({
      data: { actorId: userId, action: "setup.owner_password_reset", entityType: "User", entityId: userId, metadata: moved ? { emailMovedFrom: LEGACY_OWNER_EMAIL } : undefined },
    });
  });
  return { ok: true };
}
