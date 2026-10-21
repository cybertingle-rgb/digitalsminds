import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { DOCUMENT_MAX_BYTES, documentInput, OnboardingError, uploadDocument } from "@/modules/onboarding/service";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });
const fail = (status: number, message: string) => NextResponse.json({ ok: false, error: message }, { status });

/** Upload a student document (multipart/form-data: file, title, description, scope). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return fail(403, "Cross-site uploads are not allowed.");
  const user = await getCurrentUser();
  if (!user || !can(user.role, "onboarding.manage")) return fail(403, "You don't have permission to upload documents.");
  if (!limiter(user.id).allowed) return fail(429, "Too many uploads. Please wait a few minutes.");
  if (Number(request.headers.get("content-length") ?? 0) > DOCUMENT_MAX_BYTES + 64 * 1024) return fail(413, "The file is too large (25 MB at most).");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "Choose a file to upload.");
  const parsed = documentInput.safeParse({ scope: form.get("scope"), title: form.get("title"), description: form.get("description") ?? undefined });
  if (!parsed.success) return fail(422, parsed.error.issues[0]?.message ?? "Check the details.");
  try {
    const doc = await uploadDocument(parsed.data, { data: Buffer.from(await file.arrayBuffer()), name: file.name }, user);
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 });
  } catch (e) {
    if (e instanceof OnboardingError) return fail(e.status, e.message);
    console.error("[documents] upload failed", e);
    return fail(500, "The upload failed. Please try again.");
  }
}
