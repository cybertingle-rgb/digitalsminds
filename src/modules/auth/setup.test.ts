import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: vi.fn() }));
const { codesMatch, setupInput } = await import("./setup");

describe("codesMatch", () => {
  it("matches only the exact code", () => {
    expect(codesMatch("correct-horse-battery", "correct-horse-battery")).toBe(true);
    expect(codesMatch("correct-horse-batter", "correct-horse-battery")).toBe(false);
    expect(codesMatch("", "correct-horse-battery")).toBe(false);
  });
});

describe("setupInput", () => {
  it("requires matching passwords of at least 10 characters", () => {
    expect(setupInput.safeParse({ name: "Owner", password: "short", confirmPassword: "short", code: "x" }).success).toBe(false);
    expect(setupInput.safeParse({ name: "Owner", password: "longenough1", confirmPassword: "different11", code: "x" }).success).toBe(false);
    expect(setupInput.safeParse({ name: "Owner", password: "longenough1", confirmPassword: "longenough1", code: "x" }).success).toBe(true);
  });
});
