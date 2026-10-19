/**
 * Upload validation by file CONTENT (magic bytes), never by the name or the
 * browser-reported type alone. Only formats the platform needs are allowed:
 * no SVG (can contain scripts), no legacy Office files (macro risk), no
 * executables or archives.
 */

export type Detected =
  | { kind: "image"; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" }
  | { kind: "document"; mime: string; ext: "pdf" | "docx" | "xlsx" | "pptx" };

export const LIMITS = { image: 8 * 1024 * 1024, document: 25 * 1024 * 1024 } as const;

const OFFICE = {
  docx: { dir: "word/", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { dir: "xl/", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { dir: "ppt/", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
} as const;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/** Identify a file from its bytes. `name` is only used to tell Office formats apart and must agree. */
export function detectFile(buf: Buffer, name: string): Detected | null {
  if (buf.length < 12) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", mime: "image/png", ext: "png" };
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return { kind: "image", mime: "image/webp", ext: "webp" };
  if (buf.toString("latin1", 0, 5) === "%PDF-") return { kind: "document", mime: "application/pdf", ext: "pdf" };

  // Office Open XML files are ZIP archives; check the entries really belong to the claimed format.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = extensionOf(name);
    if (ext !== "docx" && ext !== "xlsx" && ext !== "pptx") return null;
    const listing = buf.toString("latin1");
    if (!listing.includes("[Content_Types].xml") || !listing.includes(OFFICE[ext].dir)) return null;
    // Macro-enabled content is never accepted, even under a .docx/.xlsx/.pptx name.
    if (listing.includes("vbaProject.bin")) return null;
    return { kind: "document", mime: OFFICE[ext].mime, ext };
  }
  return null;
}

/** Display-safe original name: no paths or control characters, limited length. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 120);
}

/** ASCII slug for storage keys, e.g. "Brand Guide (v2).pdf" -> "brand-guide-v2". */
export function slugForKey(name: string): string {
  const stem = cleanFileName(name).replace(/\.[^.]*$/, "");
  const slug = stem
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "file";
}
