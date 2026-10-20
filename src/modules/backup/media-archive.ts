import "server-only";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Uploaded files as a .tar archive (gzipped by the caller), written without
 * extra libraries. Restore by extracting it into the upload folder: hPanel
 * File Manager → Extract, or `tar -xzf media.tar.gz -C <upload folder>`.
 */

const BLOCK = 512;

/** Every regular file under root, as forward-slash relative paths (temporary upload files skipped). */
export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && !e.name.endsWith(".tmp")) out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  await walk(root);
  return out;
}

function field(buf: Buffer, offset: number, length: number, value: string) {
  buf.write(value, offset, Math.min(Buffer.byteLength(value), length), "utf8");
}
const octal = (n: number, length: number) => n.toString(8).padStart(length - 1, "0") + "\0";

/** ustar header; names up to 255 bytes via the prefix field. */
export function tarHeader(name: string, size: number, mtime: Date): Buffer {
  let prefix = "";
  let base = name;
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf("/", 155);
    if (cut <= 0 || Buffer.byteLength(name.slice(cut + 1)) > 100) throw new Error(`File name too long for the archive: ${name}`);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  const h = Buffer.alloc(BLOCK, 0);
  field(h, 0, 100, base);
  field(h, 100, 8, octal(0o644, 8));
  field(h, 108, 8, octal(0, 8));
  field(h, 116, 8, octal(0, 8));
  field(h, 124, 12, octal(size, 12));
  field(h, 136, 12, octal(Math.floor(mtime.getTime() / 1000), 12));
  h.fill(" ", 148, 156); // checksum is computed with this field as spaces
  field(h, 156, 1, "0");
  field(h, 257, 6, "ustar\0");
  field(h, 263, 2, "00");
  field(h, 345, 155, prefix);
  let sum = 0;
  for (const b of h) sum += b;
  field(h, 148, 8, sum.toString(8).padStart(6, "0") + "\0 ");
  return h;
}

/** Streams a tar archive of every file under root. */
export async function* tarArchive(root: string): AsyncGenerator<Uint8Array> {
  for (const rel of await listFiles(root)) {
    const full = path.join(root, rel);
    const info = await stat(full);
    yield tarHeader(rel, info.size, info.mtime);
    let written = 0;
    for await (const chunk of createReadStream(full)) {
      // Never write more than the header promised (a file growing mid-backup would corrupt the archive).
      const piece = (chunk as Buffer).subarray(0, info.size - written);
      written += piece.length;
      if (piece.length) yield piece;
      if (written >= info.size) break;
    }
    if (written < info.size) yield Buffer.alloc(info.size - written, 0);
    const rest = info.size % BLOCK;
    if (rest) yield Buffer.alloc(BLOCK - rest, 0);
  }
  yield Buffer.alloc(BLOCK * 2, 0);
}
