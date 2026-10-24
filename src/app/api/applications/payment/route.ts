import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { APPLICATION_COOKIE } from "@/modules/admissions/cookie";
import { looksLikeToken } from "@/modules/admissions/rules";
import { paymentInput, PaymentNotAllowed, submitApplicationPayment } from "@/modules/admissions/service";
import { PaymentError, RECEIPT_MAX_BYTES } from "@/modules/payments/service";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 6, windowMs: 60 * 60 * 1000 });
/** Errors are keys of dict.payments.errors; the form translates them. */
const fail = (status: number, error: string, field?: string) => NextResponse.json({ ok: false, error, ...(field && { field }) }, { status });

/** The applicant sends the transaction details and receipt (multipart/form-data). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return fail(403, "generic");
  const token = request.cookies.get(APPLICATION_COOKIE)?.value;
  if (!looksLikeToken(token)) return fail(401, "notAvailable");
  if (!limiter(clientIp(request.headers)).allowed) return fail(429, "tooMany");
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
  const parsed = paymentInput.safeParse({ method: text("method"), reference: text("reference") ?? "", payerName: text("payerName"), paidOn: text("paidOn") ?? "", note: text("note"), sentAmount: text("sentAmount") ?? "", sentCurrency: text("sentCurrency") ?? "" });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return fail(422, ["reference", "paidOn", "method", "sentAmount", "sentCurrency"].includes(field) ? field : "generic", field);
  }
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return fail(422, "receiptMissing", "receipt");
  if (file.size > RECEIPT_MAX_BYTES) return fail(413, "receiptTooLarge", "receipt");

  try {
    await submitApplicationPayment(token, parsed.data, { data: Buffer.from(await file.arrayBuffer()), name: file.name });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof PaymentNotAllowed) return fail(e.status, e.message, e.message === "referenceUsed" ? "reference" : undefined);
    if (e instanceof PaymentError) return fail(e.status, e.message, e.message.startsWith("receipt") ? "receipt" : undefined);
    console.error("[applications] payment failed", e);
    return fail(500, "generic");
  }
}
