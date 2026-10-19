import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/env";
import { CLIENT_IP_HEADER, clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

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
  const forwarded = new Request(request.url, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  });
  return auth.handler(forwarded);
}

export { handle as GET, handle as POST };
