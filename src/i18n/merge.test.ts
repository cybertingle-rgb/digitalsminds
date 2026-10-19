import { describe, expect, it } from "vitest";
import { format, mergeDictionary } from "./merge";

const base = { a: "Hello", nested: { b: "World", list: ["x", "y"] } };

describe("mergeDictionary", () => {
  it("returns the base unchanged for the default locale", () => {
    expect(mergeDictionary(base, undefined, false)).toBe(base);
  });

  it("uses translated values and isolates English fallbacks", () => {
    const out = mergeDictionary(base, { a: "سلام" }, true);
    expect(out.a).toBe("سلام");
    expect(out.nested.b).toBe("⁦World⁩");
    expect(out.nested.list).toEqual(["⁦x⁩", "⁦y⁩"]);
  });

  it("replaces lists as a whole", () => {
    const out = mergeDictionary(base, { nested: { list: ["الف"] } }, true);
    expect(out.nested.list).toEqual(["الف"]);
  });
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("Interested in {service}? {x}", { service: "SEO" })).toBe("Interested in SEO? {x}");
  });
});
