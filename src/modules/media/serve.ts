import "server-only";
import { Readable } from "node:stream";
import { fileExists, readStream } from "@/lib/storage/local";

/** Streams a stored file with headers that stop browsers from executing or sniffing it. */
export async function fileResponse(
  asset: { storageKey: string; mimeType: string; sizeBytes: number; originalName: string },
  opts: { cacheControl: string },
): Promise<Response> {
  if (!(await fileExists(asset.storageKey))) return new Response("Not found", { status: 404 });
  const isImage = asset.mimeType.startsWith("image/");
  const encodedName = encodeURIComponent(asset.originalName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  const body = Readable.toWeb(readStream(asset.storageKey)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.sizeBytes),
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": opts.cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
