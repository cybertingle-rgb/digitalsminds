import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 10).allowed).toBe(true);
    const blocked = check("ip", 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(check("ip", 1000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(check("a", 0).allowed).toBe(true);
    expect(check("b", 0).allowed).toBe(true);
    expect(check("a", 1).allowed).toBe(false);
  });
});
