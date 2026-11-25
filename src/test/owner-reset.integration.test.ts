/**
 * Owner password recovery with ADMIN_SETUP_CODE, against a real database. Run with `npm run test:db`.
 * Uses its own owner rows and restores whatever owner rows already existed.
 */
import { randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;
const CODE = "test-setup-code-0123456789";

run("owner password recovery (integration)", async () => {
  process.env.ADMIN_SETUP_CODE = CODE;
  const { db } = await import("@/lib/db");
  const { resetOwnerPassword } = await import("@/modules/auth/setup");
  const { siteConfig } = await import("@/config/site");
  const NEW = siteConfig.superAdminEmail;
  const OLD = "info@digitalsminds.com";
  const tag = randomUUID().slice(0, 8);
  const ownerId = `t${tag}_owner`;
  const studentId = `t${tag}_student`;
  let parked: { id: string; email: string }[] = [];

  beforeAll(async () => {
    // Park any real owner rows on these addresses so the test controls them.
    parked = await db().user.findMany({ where: { email: { in: [NEW, OLD] } }, select: { id: true, email: true } });
    for (const p of parked) await db().user.update({ where: { id: p.id }, data: { email: `parked-${tag}-${p.id}@example.com` } });
    await db().user.createMany({
      data: [
        { id: ownerId, name: "Owner", email: OLD, googleEmail: OLD, role: "SUPER_ADMIN", emailVerified: true },
        { id: studentId, name: "Student", email: `s.${tag}@example.com`, role: "STUDENT", emailVerified: true },
      ],
    });
    await db().account.create({ data: { id: `t${tag}_acc`, userId: ownerId, accountId: ownerId, providerId: "credential", password: "old-hash" } });
    await db().account.create({ data: { id: `t${tag}_sacc`, userId: studentId, accountId: studentId, providerId: "credential", password: "student-hash" } });
    await db().session.create({ data: { id: `t${tag}_sess`, userId: ownerId, token: `tok-${tag}`, expiresAt: new Date(Date.now() + 3600_000), updatedAt: new Date() } });
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: ownerId } });
    await db().session.deleteMany({ where: { userId: { in: [ownerId, studentId] } } });
    await db().account.deleteMany({ where: { userId: { in: [ownerId, studentId] } } });
    await db().user.deleteMany({ where: { id: { in: [ownerId, studentId] } } });
    for (const p of parked) await db().user.update({ where: { id: p.id }, data: { email: p.email } });
    await db().$disconnect();
  });

  it("refuses a wrong code and changes nothing", async () => {
    expect(await resetOwnerPassword({ password: "New-owner-pass-1", confirmPassword: "New-owner-pass-1", code: "wrong" })).toMatchObject({ ok: false });
    expect((await db().user.findUniqueOrThrow({ where: { id: ownerId } })).email).toBe(OLD);
  });

  it("moves an owner still on the old address, sets the password, signs out old sessions", async () => {
    expect(await resetOwnerPassword({ password: "New-owner-pass-1", confirmPassword: "New-owner-pass-1", code: CODE })).toEqual({ ok: true });
    const owner = await db().user.findUniqueOrThrow({ where: { id: ownerId } });
    expect(owner).toMatchObject({ email: NEW, googleEmail: NEW, role: "SUPER_ADMIN", status: "ACTIVE" });
    const acc = await db().account.findFirstOrThrow({ where: { userId: ownerId, providerId: "credential" } });
    expect(await verifyPassword({ hash: acc.password!, password: "New-owner-pass-1" })).toBe(true);
    expect(await db().session.count({ where: { userId: ownerId } })).toBe(0);
    expect(await db().auditLog.count({ where: { actorId: ownerId, action: "setup.owner_password_reset" } })).toBe(1);
    // Other accounts are untouched.
    expect((await db().account.findFirstOrThrow({ where: { userId: studentId } })).password).toBe("student-hash");
  });

  it("works again once the owner is on the new address", async () => {
    expect(await resetOwnerPassword({ password: "Another-pass-22", confirmPassword: "Another-pass-22", code: CODE })).toEqual({ ok: true });
    const acc = await db().account.findFirstOrThrow({ where: { userId: ownerId, providerId: "credential" } });
    expect(await verifyPassword({ hash: acc.password!, password: "Another-pass-22" })).toBe(true);
  });
});
