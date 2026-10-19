# Architecture

## Directory layout

```
prisma/
  schema.prisma          Data model (single source of truth)
  migrations/            Versioned SQL migrations, committed to git
prisma.config.ts         Prisma CLI config (schema/migrations paths, DATABASE_URL)
public/brand/            Official logo files (add yours here)
src/
  app/                   Next.js App Router
    (marketing)/         Public site route group: shared header/footer layout
      page.tsx           Home
      about/ services/ services/[slug]/ blog/ blog/[slug]/ contact/
      error.tsx          Error boundary for the public site
    api/
      inquiries/route.ts POST lead capture
      health/route.ts    GET liveness + DB readiness
    layout.tsx           Root <html>, global metadata
    not-found.tsx, global-error.tsx, robots.ts, sitemap.ts
  components/
    ui/                  Primitives: Button, Container, Section, SectionHeading
    layout/              Header, footer, nav, contact channels
    sections/            Page sections: Hero, Pillars, ServicesGrid, ProcessSteps, CtaBanner
    forms/               InquiryForm (client component)
    brand/               BrandLogo
  config/
    site.ts              Brand identity, nav, CTA, contact channels, logo slot
    features.ts          Flags for Phase 2 modules
  content/               Services and blog content + accessors
  lib/                   Cross-cutting infrastructure (env, db, http errors, rate limit, request helpers)
  modules/               Feature modules (domain logic), one folder per feature
    inquiries/
      schema.ts          Zod input schema (shared client/server)
      service.ts         Persistence + side effects (server-only)
  generated/prisma/      Generated Prisma client (git-ignored)
```

### Conventions for adding features

1. Create `src/modules/<feature>/` with `schema.ts` (Zod), `service.ts` (`import "server-only"`; DB access), and tests next to the code.
2. Expose it via route handlers in `src/app/api/<feature>/` (for client/mobile/third-party use) or server actions.
3. Add pages in a route group: `(marketing)` for public pages, and later `(portal)` and `admin` (see STUDENT_PORTAL.md).
4. Change the schema only through migrations: `npm run db:migrate -- --name <change>`.
5. Add any new env var to `src/lib/env.ts` (validated) **and** `.env.example`.

## Request flow: inquiry

```
InquiryForm (client)
  └─ validates with inquiryInputSchema (instant UX feedback)
  └─ POST /api/inquiries (JSON)
       1. Origin check (CSRF): reject foreign browser origins
       2. Content-Type must be application/json
       3. Per-IP rate limit (5 per 10 min)
       4. Body size cap (16 KB) + JSON parse
       5. Honeypot filled → fake 201, nothing stored
       6. inquiryInputSchema (authoritative validation) → 422 with field errors
       7. createInquiry → Prisma insert → optional webhook (5s timeout, non-fatal)
       → 201 { ok: true }
  Any unexpected error → logged server-side, generic 500 to the client
```

## Security model

- **Secrets:** only via environment variables; `.env*` git-ignored except `.env.example`. Server env is validated in `src/lib/env.ts`, a `server-only` module, so it can never be bundled to the browser. Only `NEXT_PUBLIC_*` values reach the client, and those are non-secret by design.
- **Validation:** every API input is parsed by Zod with length limits; Prisma parameterises all queries.
- **Errors:** `ApiError` for safe client-facing messages; everything else becomes a generic 500.
- **Headers** (`next.config.ts`): CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, HSTS. `X-Powered-By` disabled.
  - CSP allows `'unsafe-inline'` scripts because pages are statically rendered and Next.js inlines its bootstrap. For a stricter policy, move to per-request nonces via `src/proxy.ts`; note that this makes every page dynamically rendered.
  - HSTS is `max-age=31536000`. Add `includeSubDomains; preload` only when every subdomain is HTTPS-only.
- **Spam/abuse:** honeypot + rate limiting. The limiter is in-memory, so it is per-instance. On serverless or multi-instance hosting, back it with Redis/Upstash (same `createRateLimiter` interface), and consider adding Cloudflare Turnstile or reCAPTCHA if spam appears.
- **Privacy:** IP addresses are used for rate limiting only and are not stored.

## Rendering

Marketing pages, service pages and blog posts are statically prerendered at build time.
`/contact` renders per request (it reads `?service=`), and the API routes are dynamic.
`NEXT_PUBLIC_*` variables are inlined at build, so rebuild after changing them.
