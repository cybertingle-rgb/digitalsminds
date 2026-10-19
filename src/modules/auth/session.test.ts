import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
const { safeNext } = await import("./session");

describe("safeNext", () => {
  it("allows same-site relative paths", () => {
    expect(safeNext("/admin/integrations")).toBe("/admin/integrations");
    expect(safeNext("/ur/account?tab=1")).toBe("/ur/account?tab=1");
  });

  it("rejects external and protocol-relative URLs", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });
});
