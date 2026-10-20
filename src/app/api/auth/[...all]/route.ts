import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { CLIENT_IP_HEADER, clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Per-account limits on top of Better Auth's per-IP limits, so guessing one
 * account's password (or flooding one inbox) stays capped even if requests
 * come from many addresses.
 */
const perEmail: Record<string, ReturnType<typeof createRateLimiter>> = {
  // High enough that someone typing wrong passwords can't lock the real user out, low enough to stop guessing.
  "/sign-in/email": createRateLimiter({ limit: 50, windowMs: 60 * 60_000 }),
  "/sign-up/email": createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
  "/request-password-reset": createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
  "/send-verification-email": createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

function emailOf(body: ArrayBuffer): string | null {
  try {
    const email = (JSON.parse(new TextDecoder().decode(body)) as { email?: unknown }).email;
    return typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : null;
  } catch {
    return null;
  }
}

/**
 * Passes requests to Better Auth with a trustworthy client IP for rate
 * limiting: any client-supplied CLIENT_IP_HEADER is removed and replaced with
 * the address our proxy reported.
 */
async function handle(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ message: "Accounts are not available yet.", code: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  const auth = await getAuth();
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  const ip = clientIp(request.headers);
  if (ip !== "unknown") headers.set(CLIENT_IP_HEADER, ip);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const limiter = request.method === "POST" ? Object.entries(perEmail).find(([path]) => new URL(request.url).pathname.endsWith(path)) : undefined;
  const email = limiter && body ? emailOf(body) : null;
  if (limiter && email) {
    const r = limiter[1](`${limiter[0]}:${email}`);
    if (!r.allowed) {
      return NextResponse.json({ message: "Too many attempts. Please wait and try again.", code: "TOO_MANY_REQUESTS" }, { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } });
    }
  }
  const forwarded = new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
  });
  return auth.handler(forwarded);
}

export { handle as GET, handle as POST };
