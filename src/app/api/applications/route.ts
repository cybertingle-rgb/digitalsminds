import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { AdmissionError, applicationInput, submitApplication } from "@/modules/admissions/service";
import { CV_MAX_BYTES } from "@/modules/admissions/rules";

export const dynamic = "force-dynamic";

const byIp = createRateLimiter({ limit: 8, windowMs: 60 * 60 * 1000 });
const byEmail = createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });
/** Errors are keys of dict.apply.errors; the form translates them. */
const fail = (status: number, error: string, field?: string) => NextResponse.json({ ok: false, error, ...(field && { field }) }, { status });

/** A visitor applies for a batch (multipart/form-data with the CV). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return fail(403, "generic");
  if (!byIp(clientIp(request.headers)).allowed) return fail(429, "tooMany");
  if (Number(request.headers.get("content-length") ?? 0) > CV_MAX_BYTES + 64 * 1024) return fail(413, "cvTooLarge", "cv");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "generic");
  }
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  // Honeypot: bots fill every field. Pretend success, store nothing.
  if (text("website")) return NextResponse.json({ ok: true, reference: "DM-0000-0000", email: "" }, { status: 201 });

  const parsed = applicationInput.safeParse({
    batchId: text("batchId"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    cnic: text("cnic"),
    message: text("message"),
    acceptTerms: form.get("acceptTerms") === "on",
    displayCurrency: text("displayCurrency") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    return fail(422, field || "generic", field);
  }
  if (!byEmail(parsed.data.email).allowed) return fail(429, "tooMany");
  const cv = form.get("cv");
  if (!(cv instanceof File) || cv.size === 0) return fail(422, "cvMissing", "cv");
  if (cv.size > CV_MAX_BYTES) return fail(413, "cvTooLarge", "cv");

  try {
    const result = await submitApplication(parsed.data, { data: Buffer.from(await cv.arrayBuffer()), name: cv.name });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    if (e instanceof AdmissionError) return fail(e.status, e.message, e.field);
    console.error("[applications] submit failed", e);
    return fail(500, "generic");
  }
}
