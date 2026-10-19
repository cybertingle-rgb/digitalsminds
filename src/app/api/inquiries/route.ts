import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { ApiError, errorResponse, fieldErrors } from "@/lib/http";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { inquiryInputSchema } from "@/modules/inquiries/schema";
import { createInquiry } from "@/modules/inquiries/service";

const MAX_BODY_BYTES = 16 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request.headers, [siteConfig.url])) {
      throw new ApiError(403, "forbidden_origin", "Cross-site requests are not allowed.");
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new ApiError(415, "unsupported_media_type", "Send the inquiry as JSON.");
    }

    const rate = limiter(clientIp(request.headers));
    if (!rate.allowed) {
      return errorResponse(
        new ApiError(429, "rate_limited", "Too many submissions. Please try again later."),
        { "retry-after": String(rate.retryAfterSeconds) },
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      throw new ApiError(413, "payload_too_large", "The inquiry is too large.");
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "invalid_json", "The request body is not valid JSON.");
    }

    // Honeypot filled: pretend success so bots learn nothing, store nothing.
    if (body && typeof body === "object" && "website" in body && (body as { website?: unknown }).website) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const parsed = inquiryInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "validation_failed", "Please check the highlighted fields.", fieldErrors(parsed.error));
    }

    await createInquiry(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
