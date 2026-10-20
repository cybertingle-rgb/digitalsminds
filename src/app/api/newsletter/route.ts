import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { ApiError, errorResponse } from "@/lib/http";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { requestSubscription, signupInput } from "@/modules/newsletter/service";

const byIp = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

/** Newsletter sign-up: sends a confirmation email (nothing is stored as a subscriber until confirmed). */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request.headers, [siteConfig.url])) throw new ApiError(403, "forbidden_origin", "Cross-site requests are not allowed.");
    const rate = byIp(clientIp(request.headers));
    if (!rate.allowed) return errorResponse(new ApiError(429, "rate_limited", "Too many attempts."), { "retry-after": String(rate.retryAfterSeconds) });
    const raw = await request.text();
    if (raw.length > 2048) throw new ApiError(413, "payload_too_large", "Too large.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "invalid_json", "Invalid request.");
    }
    // Honeypot: pretend success.
    if (body && typeof body === "object" && (body as { website?: unknown }).website) return NextResponse.json({ ok: true });
    const parsed = signupInput.safeParse(body);
    if (!parsed.success) throw new ApiError(422, "validation_failed", "Invalid email.");
    try {
      await requestSubscription(parsed.data);
    } catch (err) {
      console.warn("[newsletter] sign-up failed:", err instanceof Error ? err.message : err);
      throw new ApiError(503, "unavailable", "Please try again later.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
