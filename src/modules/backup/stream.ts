import "server-only";

/** Turns a generator of text/bytes into a gzipped download body. */
export function gzipStream(source: AsyncGenerator<string | Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const raw = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await source.next();
        if (done) controller.close();
        else controller.enqueue(typeof value === "string" ? enc.encode(value) : value);
      } catch (e) {
        console.error("[backup] failed while streaming", e);
        controller.error(e);
      }
    },
    async cancel() {
      await source.return(undefined);
    },
  });
  return raw.pipeThrough(new CompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
}

export const downloadHeaders = (filename: string, type: string) => ({
  "Content-Type": type,
  "Content-Disposition": `attachment; filename="${filename}"`,
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
});
