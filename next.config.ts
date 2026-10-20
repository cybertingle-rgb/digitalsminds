import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Static CSP that keeps pages statically renderable. Next.js injects inline
 * bootstrap scripts, so script-src needs 'unsafe-inline' unless we switch to
 * per-request nonces (see docs/ARCHITECTURE.md > Security).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  // Course videos are embedded from Google Drive (Phase 8).
  "frame-src 'self' https://drive.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Add includeSubDomains/preload only once every subdomain is confirmed HTTPS-only.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Shared hosting (Hostinger) reports many CPUs but limits how many threads an
  // account may start, so a default build spawns ~60 workers and crashes with
  // "OS can't spawn worker thread". A few workers are plenty for this site.
  experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) || 2 },
  // `NEXT_OUTPUT=standalone npm run build` produces a self-contained server for VPS/cPanel/Docker.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
