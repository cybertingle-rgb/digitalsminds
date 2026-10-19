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
  it("uses the entry added by our proxy, not the spoofable left-most one", () => {
    // Client sent "6.6.6.6"; our proxy appended the real address 1.2.3.4.
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });
  it("supports more than one trusted proxy hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4, 10.0.0.2" }), 2)).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }), 3)).toBe("1.2.3.4");
  });
  it("falls back to unknown", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
