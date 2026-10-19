import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Plain function instead of vi.fn(): Vitest's spy reports promises it sees
// reject as test errors, which would break the internal-error test.
let calls = 0;
let failWith: Error | undefined;
vi.mock("@/modules/inquiries/service", () => ({
  createInquiry: async () => {
    calls += 1;
    if (failWith) throw failWith;
    return { id: "x", createdAt: new Date() };
  },
}));

const { POST } = await import("./route");

let ip = 0;
function post(body: unknown, headers: Record<string, string> = {}) {
  ip += 1; // fresh IP per request so the rate limiter does not interfere
  return POST(
    new NextRequest("http://localhost:3000/api/inquiries", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        "x-forwarded-for": `10.0.0.${ip}`,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const valid = {
  name: "Test User",
  email: "test@example.com",
  service: "general",
  message: "Hello, I'd like to learn more about your services.",
};

describe("POST /api/inquiries", () => {
  beforeEach(() => {
    calls = 0;
    failWith = undefined;
  });

  it("stores a valid inquiry", async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(calls).toBe(1);
  });

  it("returns field errors for invalid input", async () => {
    const res = await post({ ...valid, email: "nope" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.details.email).toBeDefined();
    expect(calls).toBe(0);
  });

  it("silently drops honeypot submissions", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(calls).toBe(0);
  });

  it("rejects cross-site origins", async () => {
    const res = await post(valid, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("rejects non-JSON bodies", async () => {
    const res = await post("name=x", { "content-type": "application/x-www-form-urlencoded" });
    expect(res.status).toBe(415);
  });

  it("rejects malformed JSON", async () => {
    expect((await post("{oops")).status).toBe(400);
  });

  it("hides internal errors", async () => {
    failWith = new Error("db password=secret");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("rate limits repeated submissions from one IP", async () => {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(new NextRequest("http://localhost:3000/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
      body: JSON.stringify(valid),
    }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
