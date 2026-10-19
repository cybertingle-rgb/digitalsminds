/**
 * Team safeguards and instructor scoping against a real database.
 * Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("team service (integration)", async () => {
  const { db } = await import("@/lib/db");
  const team = await import("@/modules/team/service");
  const { canManageCourse, manageableCoursesWhere } = await import("@/modules/auth/scoping");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const mk = (n: string, role: "SUPER_ADMIN" | "CONTENT_MANAGER" | "INSTRUCTOR" | "STUDENT", email?: string) =>
    db().user.create({ data: { id: id(n), name: n, email: email ?? `${n}.${tag}@example.com`, role } });

  beforeAll(async () => {
    // Other test runs may leave Super Admins behind; these tests need to control the count.
    await db().user.updateMany({ where: { role: "SUPER_ADMIN", id: { not: { startsWith: `t${tag}` } } }, data: { status: "SUSPENDED" } });
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { OR: [{ actorId: { startsWith: `t${tag}` } }, { entityId: { startsWith: `t${tag}` } }] } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("keeps at least one active Super Admin and blocks self-changes", async () => {
    const a = await mk("superA", "SUPER_ADMIN");
    const b = await mk("superB", "SUPER_ADMIN");
    await expect(team.changeRole(a.id, "CONTENT_MANAGER", a.id)).rejects.toThrow(/own access/);
    // b can demote a while b remains an active Super Admin...
    await team.changeRole(a.id, "CONTENT_MANAGER", b.id);
    // ...but a (now Content Manager) can't be used to remove the last one: only b is left.
    const c = await mk("superC", "SUPER_ADMIN");
    await team.setSuspended(b.id, true, "test", c.id);
    await expect(team.removeFromTeam(c.id, a.id)).rejects.toThrow(/at least one active Super Admin/);
    await expect(team.setSuspended(c.id, true, null, a.id)).rejects.toThrow(/at least one active Super Admin/);
  });

  it("never lets anyone change the owner account", async () => {
    const owner = await db().user.findUnique({ where: { email: "info@digitalsminds.com" } });
    const actor = await mk("superD", "SUPER_ADMIN");
    const target = owner ?? (await mk("owner", "SUPER_ADMIN", "info@digitalsminds.com"));
    await expect(team.setSuspended(target.id, true, null, actor.id)).rejects.toThrow(/owner account/);
    await expect(team.changeRole(target.id, "INSTRUCTOR", actor.id)).rejects.toThrow(/owner account/);
  });

  it("suspension and removal sign the person out everywhere", async () => {
    const actor = await mk("superE", "SUPER_ADMIN");
    const cm = await mk("cm", "CONTENT_MANAGER");
    await db().session.create({ data: { id: id("s1"), token: id("tok1"), userId: cm.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await team.setSuspended(cm.id, true, "left the company", actor.id);
    expect(await db().session.count({ where: { userId: cm.id } })).toBe(0);
    expect((await db().user.findUniqueOrThrow({ where: { id: cm.id } })).status).toBe("SUSPENDED");

    await team.setSuspended(cm.id, false, null, actor.id);
    await db().session.create({ data: { id: id("s2"), token: id("tok2"), userId: cm.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await team.removeFromTeam(cm.id, actor.id);
    const after = await db().user.findUniqueOrThrow({ where: { id: cm.id } });
    expect(after.role).toBe("STUDENT");
    expect(await db().session.count({ where: { userId: cm.id } })).toBe(0);
    const actions = (await db().auditLog.findMany({ where: { entityId: cm.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["user.suspend", "user.reactivate", "team.removed"]));
  });

  it("promotes an existing student instead of creating a duplicate", async () => {
    const actor = await mk("superF", "SUPER_ADMIN");
    const student = await mk("student", "STUDENT");
    const res = await team.inviteStaff({ name: "Student", email: student.email, role: "INSTRUCTOR" }, actor.id);
    expect(res.promoted).toBe(true);
    expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).role).toBe("INSTRUCTOR");
    await expect(team.inviteStaff({ name: "Student", email: student.email, role: "INSTRUCTOR" }, actor.id)).rejects.toThrow(/already on the team/);
  });

  it("limits instructors to their assigned courses", async () => {
    const instructor = await mk("instr", "INSTRUCTOR");
    const cm = await mk("cm2", "CONTENT_MANAGER");
    const student = await mk("stud2", "STUDENT");
    const mine = await db().course.create({ data: { slug: id("mine"), language: "en", title: "Mine", summary: "s", instructors: { create: { userId: instructor.id } } } });
    const other = await db().course.create({ data: { slug: id("other"), language: "en", title: "Other", summary: "s" } });

    expect(await canManageCourse(instructor, mine.id)).toBe(true);
    expect(await canManageCourse(instructor, other.id)).toBe(false);
    expect(await canManageCourse(cm, other.id)).toBe(true);
    expect(await canManageCourse(student, mine.id)).toBe(false);

    const visible = await db().course.findMany({ where: { AND: [manageableCoursesWhere(instructor), { slug: { startsWith: `t${tag}` } }] } });
    expect(visible.map((c) => c.id)).toEqual([mine.id]);
    expect(await db().course.count({ where: { AND: [manageableCoursesWhere(student), { slug: { startsWith: `t${tag}` } }] } })).toBe(0);
  });
});
