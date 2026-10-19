/** Best-effort client IP from proxy headers (set by Vercel, Nginx, Cloudflare, etc.). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * CSRF defence for JSON endpoints: browsers always send Origin on
 * cross-site POSTs, so reject any Origin that is not this site.
 */
export function isSameOrigin(headers: Headers, allowedOrigins: string[]): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, server-to-server)
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const candidates = new Set(allowedOrigins);
  if (host) {
    candidates.add(`${proto}://${host}`);
    candidates.add(`https://${host}`);
  }
  return candidates.has(origin);
}
