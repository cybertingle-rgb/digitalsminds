import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { decryptSecret, encryptSecret } = await import("./secrets");

const secret = "x".repeat(40);
const other = "y".repeat(40);

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, including Urdu text", () => {
    const token = encryptSecret("p@ss wörd اردو", secret);
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("p@ss");
    expect(decryptSecret(token, secret)).toBe("p@ss wörd اردو");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", secret)).not.toBe(encryptSecret("same", secret));
  });

  it("rejects tampered data and the wrong secret", () => {
    const token = encryptSecret("value", secret);
    const parts = token.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join("."), secret)).toThrow();
    expect(() => decryptSecret(token, other)).toThrow();
    expect(() => decryptSecret("garbage", secret)).toThrow();
  });
});
