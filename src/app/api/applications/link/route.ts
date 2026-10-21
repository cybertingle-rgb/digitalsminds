import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/request";
import { resendApplicationLink } from "@/modules/admissions/service";

export const dynamic = "force-dynamic";

const byIp = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });
const byEmail = createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });
const input = z.object({ email: z.email().max(254), reference: z.string().trim().min(6).max(20) });

/** "Email me a new link". Always answers the same way, so it reveals nothing about who applied. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers, [siteConfig.url])) return NextResponse.json({ ok: false }, { status: 403 });
  if (!byIp(clientIp(request.headers)).allowed) return NextResponse.json({ ok: false, error: "tooMany" }, { status: 429 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { status: 422 });
  if (byEmail(parsed.data.email.toLowerCase()).allowed) {
    try {
      await resendApplicationLink(parsed.data.email, parsed.data.reference);
    } catch (e) {
      console.error("[applications] link resend failed", e);
    }
  }
  return NextResponse.json({ ok: true });
}
