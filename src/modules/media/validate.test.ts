import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { cleanFileName, detectFile, slugForKey } from "./validate";

vi.mock("server-only", () => ({}));
const { processImage } = await import("./images");

const zipWith = (...entries: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(entries.join("\0"), "latin1"), Buffer.alloc(16)]);

describe("detectFile", () => {
  it("recognises allowed images and PDFs by content", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fdcf31" } }).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(detectFile(png, "x.png")?.mime).toBe("image/png");
    expect(detectFile(jpg, "photo.JPEG")?.mime).toBe("image/jpeg");
    expect(detectFile(webp, "x.webp")?.mime).toBe("image/webp");
    expect(detectFile(Buffer.from("%PDF-1.7\n" + "x".repeat(20)), "notes.pdf")?.ext).toBe("pdf");
  });

  it("checks Office files really contain the claimed format", () => {
    expect(detectFile(zipWith("[Content_Types].xml", "word/document.xml"), "a.docx")?.ext).toBe("docx");
    expect(detectFile(zipWith("[Content_Types].xml", "xl/workbook.xml"), "a.xlsx")?.ext).toBe("xlsx");
    expect(detectFile(zipWith("[Content_Types].xml", "word/document.xml"), "a.xlsx")).toBeNull();
    expect(detectFile(zipWith("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin"), "a.docx")).toBeNull();
    expect(detectFile(zipWith("evil.exe"), "a.zip")).toBeNull();
  });

  it("rejects SVG, HTML, executables and disguised files", () => {
    expect(detectFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.svg")).toBeNull();
    expect(detectFile(Buffer.from("<html><body>hi</body></html>"), "photo.jpg")).toBeNull();
    expect(detectFile(Buffer.from("MZ\x90\x00" + "x".repeat(20), "latin1"), "photo.jpg")).toBeNull();
    expect(detectFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]), "old.doc")).toBeNull();
    expect(detectFile(Buffer.from("tiny"), "x.png")).toBeNull();
  });
});

describe("file names", () => {
  it("strips paths and control characters but keeps Urdu for display", () => {
    expect(cleanFileName("C:\\Users\\me\\..\\رپورٹ <final>.pdf")).toBe("رپورٹ final.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
  });
  it("makes ASCII slugs for storage keys", () => {
    expect(slugForKey("Brand Guide (v2).pdf")).toBe("brand-guide-v2");
    expect(slugForKey("رپورٹ.pdf")).toBe("file");
  });
});

describe("processImage", () => {
  it("removes EXIF/GPS metadata and limits size", async () => {
    const withExif = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#2b323c" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneMaker", Model: "SecretPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "31/1 25/1 0/1" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processImage(withExif, "image/jpeg");
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(out.data.includes(Buffer.from("SecretPhone"))).toBe(false);
    expect(Math.max(out.width, out.height)).toBe(2560);
  });

  it("rejects bytes that only look like an image", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("not really a jpeg".repeat(4))]);
    await expect(processImage(fake, "image/jpeg")).rejects.toThrow();
  });
});
