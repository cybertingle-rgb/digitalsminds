import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { getCurrentUser } from "@/modules/auth/session";
import { canUseMediaLibrary, MediaError, mediaUrl, replaceAsset, uploadAsset } from "@/modules/media/service";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 26 * 1024 * 1024;
const limiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });

const fields = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  altText: z.string().max(255).optional(),
  altTextUr: z.string().max(255).optional(),
  replaceId: z.string().max(64).optional(),
});

const fail = (status: number, message: string) => NextResponse.json({ ok: false, error: message }, { status });

/** Upload (or replace) a media file. multipart/form-data with a `file` field. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return fail(403, "Cross-site uploads are not allowed.");
  const user = await getCurrentUser();
  if (!user || !canUseMediaLibrary(user)) return fail(403, "You don't have permission to upload files.");
  if (!limiter(user.id).allowed) return fail(429, "Too many uploads. Please wait a few minutes.");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES) return fail(413, "The file is too large. Images can be at most 8 MB, documents 25 MB.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "Choose a file to upload.");
  if (file.size > MAX_REQUEST_BYTES) return fail(413, "The file is too large.");
  const parsed = fields.safeParse({
    visibility: form.get("visibility") ?? undefined,
    altText: form.get("altText") ?? undefined,
    altTextUr: form.get("altTextUr") ?? undefined,
    replaceId: form.get("replaceId") || undefined,
  });
  if (!parsed.success) return fail(400, "Invalid upload details.");

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const asset = parsed.data.replaceId
      ? await replaceAsset(parsed.data.replaceId, { data, originalName: file.name }, user)
      : await uploadAsset({ data, originalName: file.name, ...parsed.data }, user);
    return NextResponse.json({ ok: true, asset: { id: asset.id, url: mediaUrl(asset), name: asset.originalName } }, { status: 201 });
  } catch (e) {
    if (e instanceof MediaError) return fail(e.status, e.message);
    console.error("[media] upload failed", e);
    return fail(500, "The upload failed. Please try again.");
  }
}
