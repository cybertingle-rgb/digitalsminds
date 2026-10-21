import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseRichText, RichText } from "./richtext";
import { courseDetailsInput, slugify } from "./schema";


describe("rich text", () => {
  it("parses headings, lists and paragraphs", () => {
    expect(parseRichText("## Intro\nWelcome\nline two\n\n- one\n- two\nafter")).toEqual([
      { type: "h", text: "Intro" },
      { type: "p", lines: ["Welcome", "line two"] },
      { type: "ul", items: ["one", "two"] },
      { type: "p", lines: ["after"] },
    ]);
  });

  it("never renders HTML and only links http(s)", () => {
    const html = renderToStaticMarkup(
      RichText({ text: '<script>alert(1)</script> <img src=x onerror=alert(1)> javascript:alert(1) see https://example.com/page.' }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://example.com/page"');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("course input", () => {
  it("slugifies English titles and drops non-ASCII", () => {
    expect(slugify("Digital Marketing: The Basics (2026)")).toBe("digital-marketing-the-basics-2026");
    expect(slugify("ڈیجیٹل مارکیٹنگ")).toBe("");
  });

  it("turns objectives into a clean list", () => {
    const r = courseDetailsInput.parse({
      title: "Course title",
      slug: "course-title",
      language: "ur",
      summary: "A useful summary",
      objectives: "- Learn SEO\n\n* Run ads\n  Build a brand  ",
      level: "BEGINNER",
      durationText: "",
      format: "ONLINE_LIVE",
      certificateEnabled: true,
    });
    expect(r.objectives).toEqual(["Learn SEO", "Run ads", "Build a brand"]);
    expect(r.durationText).toBeNull();
    expect(r.thumbnailId).toBeNull();
  });

  it("rejects bad slugs", () => {
    expect(courseDetailsInput.safeParse({ title: "Course", slug: "Bad Slug!", language: "en", summary: "Summary text", level: "BEGINNER", format: "ONLINE_LIVE", certificateEnabled: true }).success).toBe(false);
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes", async () => {
    const { formatMinutes } = await import("./labels");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(null)).toBeNull();
  });
});

describe("rich text images", () => {
  it("embeds only images from our own media library", () => {
    expect(parseRichText("Intro\n\n![Team photo](/media/2026/10/team.webp)\n\nAfter")).toEqual([
      { type: "p", lines: ["Intro"] },
      { type: "img", alt: "Team photo", src: "/media/2026/10/team.webp" },
      { type: "p", lines: ["After"] },
    ]);
    for (const bad of ["![x](https://evil.example/a.png)", "![x](/media/../etc/passwd)", "![x](javascript:alert(1))", '![x](/media/a.png" onerror="x)']) {
      expect(parseRichText(bad)[0]!.type).toBe("p");
    }
  });
});
