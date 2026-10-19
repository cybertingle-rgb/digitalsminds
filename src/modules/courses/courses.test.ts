import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driveEmbedUrl, driveFileId } from "./drive";
import { parseRichText, RichText } from "./richtext";
import { courseDetailsInput, resourceInput, slugify } from "./schema";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("driveFileId", () => {
  it.each([
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${ID}/view`,
    `https://drive.google.com/file/d/${ID}/preview`,
    `https://drive.google.com/file/d/${ID}`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?export=download&id=${ID}`,
    `  https://drive.google.com/file/d/${ID}/view?usp=drive_link  `,
  ])("reads the file id from %s", (url) => {
    expect(driveFileId(url)).toBe(ID);
  });

  it.each([
    "https://evil.example/file/d/" + ID,
    `http://drive.google.com/file/d/${ID}/view`,
    `https://drive.google.com.evil.example/file/d/${ID}`,
    "https://drive.google.com/drive/folders/abc",
    "javascript:alert(1)",
    `https://drive.google.com/file/d/short/view`,
    "",
  ])("rejects %s", (url) => {
    expect(driveFileId(url)).toBeNull();
  });

  it("builds the official embed URL", () => {
    expect(driveEmbedUrl(ID)).toBe(`https://drive.google.com/file/d/${ID}/preview`);
  });
});

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
      durationMinutes: "",
      certificateEnabled: true,
    });
    expect(r.objectives).toEqual(["Learn SEO", "Run ads", "Build a brand"]);
    expect(r.durationMinutes).toBeNull();
    expect(r.thumbnailId).toBeNull();
  });

  it("rejects bad slugs and non-https resource links", () => {
    expect(courseDetailsInput.safeParse({ title: "Course", slug: "Bad Slug!", language: "en", summary: "Summary text", level: "BEGINNER", certificateEnabled: true }).success).toBe(false);
    expect(resourceInput.safeParse({ kind: "LINK", title: "Doc", url: "http://example.com" }).success).toBe(false);
    expect(resourceInput.safeParse({ kind: "LINK", title: "Doc", url: "javascript:alert(1)" }).success).toBe(false);
    expect(resourceInput.safeParse({ kind: "LINK", title: "Doc", url: "https://example.com/a.pdf" }).success).toBe(true);
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
