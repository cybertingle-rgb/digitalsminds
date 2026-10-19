import { describe, expect, it } from "vitest";
import { clientIp, isSameOrigin } from "./request";

describe("isSameOrigin", () => {
  const allowed = ["https://digitalsminds.com"];

  it("allows requests without an Origin header (non-browser clients)", () => {
    expect(isSameOrigin(new Headers(), allowed)).toBe(true);
  });

  it("allows the configured site origin and the request host", () => {
    expect(isSameOrigin(new Headers({ origin: "https://digitalsminds.com" }), allowed)).toBe(true);
    expect(
      isSameOrigin(new Headers({ origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-proto": "http" }), allowed),
    ).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(isSameOrigin(new Headers({ origin: "https://evil.example", host: "digitalsminds.com" }), allowed)).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to unknown", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
