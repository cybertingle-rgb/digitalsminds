import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { APPLICATION_COOKIE, APPLICATION_COOKIE_MAX_AGE } from "@/modules/admissions/cookie";
import { looksLikeToken } from "@/modules/admissions/rules";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

/**
 * The emailed status link. Keeps the token in an httpOnly cookie and redirects
 * to /application, so the token leaves the address bar (and never reaches
 * browser history or referrers of later pages). It never waits on the
 * database, so the click always lands: /application checks the token and
 * confirms the email when it loads.
 */
export function GET(request: NextRequest) {
  const target = new URL("/application", siteConfig.url);
  const token = request.nextUrl.searchParams.get("t");
  if (!limiter(clientIp(request.headers)).allowed || !looksLikeToken(token)) {
    target.searchParams.set("invalid", "1");
    return NextResponse.redirect(target, 303);
  }
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(APPLICATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: APPLICATION_COOKIE_MAX_AGE,
  });
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}
