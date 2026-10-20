import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ siteSetting: { findUnique: async () => null } }) }));

describe("structured data", async () => {
  const { breadcrumbs, faqPage, serialiseJsonLd } = await import("./structured-data");

  it("can't be broken out of its <script> tag", () => {
    const out = serialiseJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });

  it("builds breadcrumbs with absolute, localised URLs", () => {
    const b = breadcrumbs("ur", [{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]) as { itemListElement: { position: number; item: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1]!.item).toMatch(/^https?:\/\/[^/]+\/ur\/blog$/);
  });

  it("describes FAQs as questions and answers", () => {
    expect(faqPage([{ q: "Q?", a: "A." }])).toMatchObject({ "@type": "FAQPage", mainEntity: [{ name: "Q?", acceptedAnswer: { text: "A." } }] });
  });
});

describe("analytics settings", async () => {
  const { analyticsInput } = await import("@/modules/content/settings");

  it("accepts a GA4 ID and the Search Console tag or bare code", () => {
    expect(analyticsInput.parse({ gaId: " g-abc123xyz ", googleVerification: '<meta name="google-site-verification" content="abcDEF123_-xyz789" />' })).toEqual({
      gaId: "G-ABC123XYZ",
      googleVerification: "abcDEF123_-xyz789",
    });
    expect(analyticsInput.parse({ gaId: "", googleVerification: "" })).toEqual({ gaId: null, googleVerification: null });
  });

  it("rejects other IDs and anything that isn't a code", () => {
    expect(() => analyticsInput.parse({ gaId: "UA-12345-1", googleVerification: "" })).toThrow(/G-XXXXXXXXXX/);
    expect(() => analyticsInput.parse({ gaId: "", googleVerification: '"><script>' })).toThrow(/Search Console/);
  });
});
