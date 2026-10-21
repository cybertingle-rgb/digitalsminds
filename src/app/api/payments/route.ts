import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { getCurrentUser } from "@/modules/auth/session";
import { PaymentError, RECEIPT_MAX_BYTES, submitInput, submitPayment } from "@/modules/payments/service";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 6, windowMs: 60 * 60 * 1000 });
/** Errors are keys of dict.payments.errors; the form translates them. */
const fail = (status: number, error: string, field?: string) => NextResponse.json({ ok: false, error, ...(field && { field }) }, { status });

/** A student sends their payment details and receipt for a paid course (multipart/form-data). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return fail(403, "generic");
  const user = await getCurrentUser();
  if (!user) return fail(401, "generic");
  if (!limiter(user.id).allowed) return fail(429, "tooMany");
  if (Number(request.headers.get("content-length") ?? 0) > RECEIPT_MAX_BYTES + 64 * 1024) return fail(413, "receiptTooLarge", "receipt");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "generic");
  }
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = submitInput.safeParse({
    method: text("method"),
    reference: text("reference") ?? "",
    payerName: text("payerName"),
    paidOn: text("paidOn") ?? "",
    googleEmail: text("googleEmail") ?? "",
    note: text("note"),
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return fail(422, ["reference", "paidOn", "googleEmail", "method"].includes(field) ? field : "generic", field);
  }
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return fail(422, "receiptMissing", "receipt");
  if (file.size > RECEIPT_MAX_BYTES) return fail(413, "receiptTooLarge", "receipt");
  const courseId = text("courseId") ?? "";

  try {
    await submitPayment(user, courseId.slice(0, 64), parsed.data, { data: Buffer.from(await file.arrayBuffer()), name: file.name });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof PaymentError) return fail(e.status, e.message, e.message.startsWith("receipt") ? "receipt" : undefined);
    console.error("[payments] submit failed", e);
    return fail(500, "generic");
  }
}
