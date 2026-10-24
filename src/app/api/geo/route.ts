import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The visitor's country as reported by a proxy/CDN in front of the site
 * (Cloudflare, Vercel and similar add one), or null. Country level only, used
 * to suggest a display currency; nothing is stored.
 */
export function GET(request: NextRequest) {
  const raw = request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? request.headers.get("x-country-code") ?? request.headers.get("cloudfront-viewer-country");
  const country = raw && /^[A-Z]{2}$/i.test(raw) && !["XX", "T1"].includes(raw.toUpperCase()) ? raw.toUpperCase() : null;
  return NextResponse.json({ country }, { headers: { "cache-control": "private, no-store", vary: "*" } });
}
