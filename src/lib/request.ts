/** Header our auth route uses to hand Better Auth the resolved client IP (client-sent copies are stripped). */
export const CLIENT_IP_HEADER = "x-dm-client-ip";

/**
 * Client IP for rate limiting. The left-most X-Forwarded-For entries are
 * whatever the client sent (spoofable); proxies append, so the trustworthy
 * value is the one added by our own proxy: `hops` from the right (default 1,
 * override with TRUSTED_PROXY_HOPS if the host chains several proxies).
 */
export function clientIp(headers: Headers, hops = Number(process.env.TRUSTED_PROXY_HOPS) || 1): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = chain[Math.max(0, chain.length - hops)];
    if (ip) return ip;
  }
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
