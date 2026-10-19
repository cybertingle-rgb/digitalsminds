import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { deleteFile, fileExists, putFile, resolveKey } = await import("./local");

describe("resolveKey", () => {
  const root = "/srv/uploads";
  it("accepts server-generated keys", () => {
    expect(resolveKey("public/2026/10/abc-logo.png", root)).toBe("/srv/uploads/public/2026/10/abc-logo.png");
  });
  it.each(["../etc/passwd", "public/../../etc/passwd", "/etc/passwd", "public//x.png", "Public/X.PNG", "public/x\0.png", "public/", ".hidden", "a/b\\c"])(
    "rejects unsafe key %s",
    (key) => {
      expect(() => resolveKey(key, root)).toThrow();
    },
  );
});

describe("local storage", () => {
  it("writes, checks and deletes files inside the root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "dm-store-"));
    await putFile("private/2026/10/a-sheet.pdf", Buffer.from("%PDF-1.4 test"), root);
    expect(await fileExists("private/2026/10/a-sheet.pdf", root)).toBe(true);
    expect((await readFile(path.join(root, "private/2026/10/a-sheet.pdf"))).toString()).toContain("%PDF");
    await deleteFile("private/2026/10/a-sheet.pdf", root);
    expect(await fileExists("private/2026/10/a-sheet.pdf", root)).toBe(false);
  });
});
