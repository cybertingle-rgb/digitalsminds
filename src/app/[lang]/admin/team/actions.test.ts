import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Plain functions (not vi.fn) so the denial path is checked without Vitest's promise tracking.
let allowed = false;
let calls: string[] = [];
vi.mock("@/modules/auth/session", async () => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    assertPermission: async (p: string) => {
      if (!allowed || p !== "staff.manage") throw new ForbiddenError("You don't have permission to do that.");
      return { id: "admin1", role: "SUPER_ADMIN" };
    },
  };
});
vi.mock("@/modules/team/service", async (orig) => {
  const real = await orig<typeof import("@/modules/team/service")>();
  const record = (name: string) => async () => {
    calls.push(name);
    return { promoted: false };
  };
  return {
    ...real,
    inviteStaff: record("invite"),
    changeRole: record("changeRole"),
    setSuspended: record("setSuspended"),
    removeFromTeam: record("remove"),
    resendInvite: record("resend"),
  };
});

const actions = await import("./actions");

const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe("team actions", () => {
  beforeEach(() => {
    calls = [];
  });

  it("refuse everyone without staff.manage and change nothing", async () => {
    allowed = false;
    const results = await Promise.all([
      actions.inviteAction({ status: "idle" }, form({ name: "New Person", email: "new@example.com", role: "SUPER_ADMIN" })),
      actions.changeRoleAction("u1", "SUPER_ADMIN"),
      actions.setSuspendedAction("u1", true),
      actions.removeAction("u1"),
      actions.resendInviteAction("u1"),
    ]);
    for (const r of results) expect(r).toMatchObject({ status: "error" });
    expect(calls).toEqual([]);
  });

  it("validate input before doing anything", async () => {
    allowed = true;
    const bad = await actions.inviteAction({ status: "idle" }, form({ name: "X", email: "nope", role: "STUDENT" }));
    expect(bad.status).toBe("error");
    expect(Object.keys(bad.fields ?? {})).toEqual(expect.arrayContaining(["name", "email", "role"]));
    expect((await actions.changeRoleAction("u1", "STUDENT")).status).toBe("error");
    expect(calls).toEqual([]);
  });

  it("run the change for a Super Admin", async () => {
    allowed = true;
    expect((await actions.changeRoleAction("u1", "INSTRUCTOR")).status).toBe("success");
    expect(calls).toEqual(["changeRole"]);
  });
});
