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
    [lang]/              Root layout per language (sets <html lang dir>), 404 page, catch-all
      (marketing)/       Public site route group: shared header/footer layout
      page.tsx           Home
      about/ services/ services/[slug]/ blog/ blog/[slug]/ contact/
      error.tsx          Error boundary for the public site
    api/
      inquiries/route.ts POST lead capture
      health/route.ts    GET liveness + DB readiness
    global-error.tsx, robots.ts, sitemap.ts, icon.png, apple-icon.png, fonts.ts
  components/
    ui/                  Primitives: Button, Container, Section, SectionHeading
    layout/              Header, footer, nav, contact channels
    sections/            Page sections: Hero, Pillars, ServicesGrid, ProcessSteps, CtaBanner
    forms/               InquiryForm (client component)
    brand/               BrandLogo
  i18n/
    config.ts            Locales, URL helpers, routing rule (used by src/proxy.ts)
    dictionaries/        en.ts (all site text) and ur.ts (Urdu, partial; falls back to English)
    get-dictionary.ts, merge.ts, metadata.ts (canonical, hreflang, noindex)
  proxy.ts               "/x" renders /en/x, "/en/x" redirects to "/x", "/ur/x" served as-is
  fonts/                 Self-hosted Noto Naskh Arabic (OFL)
  config/
    site.ts              Logos, nav structure, email, social links
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

## Authentication & authorisation (Phase 3)

```
Browser ── authClient (better-auth/react) ──▶ /api/auth/[...all]
                                               │ strips client-sent x-dm-client-ip,
                                               │ sets it from the proxy-added X-Forwarded-For hop
                                               ▼
                                    getAuth()  (src/lib/auth.ts)
                                    Better Auth + Prisma adapter, rebuilt when Google
                                    credentials change (cache on globalThis, 15 s)
```

- **Email/password**: verification required before login; reset links expire in 1 hour and revoke other sessions.
- **Google**: credentials from Admin → Integrations (encrypted), shown to students only after an admin's successful "Connect & test".
- **Hooks** (`databaseHooks`): new users are always `STUDENT`/`ACTIVE`; profile fields are validated server-side; role/status can never be
  changed through the auth API; the Super Admin email can only be created via `/setup`; suspended users cannot start sessions.
- **Server-side checks**: `requirePagePermission()` for pages (anonymous → login, no permission → 404) and `assertPermission()` for
  server actions (`src/modules/auth/session.ts`). The matrix lives in `src/modules/auth/permissions.ts` (deny by default).
- **Secrets at rest**: `src/lib/secrets.ts`, AES-256-GCM with an HKDF-derived key from `BETTER_AUTH_SECRET`.
- **Rate limiting**: Better Auth database storage (`RateLimit` table), keyed by the proxy-reported client IP (`TRUSTED_PROXY_HOPS`).
- **Email**: nodemailer over SMTP settings from the admin panel (`src/lib/mailer.ts`), branded bilingual templates in `src/modules/email`.

## Admin dashboard & leads (Phase 6)

- `src/modules/dashboard/stats.ts`: every figure is a live query, and only those the viewer's role may see.
- `src/modules/inquiries/admin.ts`: filters → Prisma `where` (spam hidden unless requested; follow-up ranges in PKT via
  `src/lib/pk-time.ts`), updates with audit of real changes only, notes, delete, export rows.
- `src/modules/inquiries/alerts.ts`: best-effort lead alert email (setting `notifications.inquiry`).
- `src/lib/csv.ts`: UTF-8 BOM + formula-injection guard. Export route: `GET /api/admin/inquiries/export` (`inquiries.export`).
- Attribution: `CampaignCapture` (client, sessionStorage) → sent with the inquiry form → `Inquiry.locale/utm*`.

## Media & file storage (Phase 5)

- `src/lib/storage/local.ts`: local-disk driver rooted at `UPLOAD_DIR` (default `~/digitalsminds-uploads`), with strict key
  validation (no traversal) and atomic writes. Swappable for object storage later behind the same functions.
- `src/modules/media/storage-check.ts`: marker file + build ID proves the folder survives deploys; uploads are disabled until then
  (and if the folder is inside the app or not writable).
- `src/modules/media/validate.ts` / `images.ts`: content sniffing, size limits, sharp re-encode (metadata stripped).
- `src/modules/media/service.ts`: upload / replace / delete (blocked while referenced) / list, scoped so Instructors only see their own.
- Routes: `POST /api/admin/media` (multipart, same-origin, rate-limited), `GET /media/...` (public, DB-checked, immutable),
  `GET /api/files/[id]` (private, access-checked). Responses send `nosniff`, a sandboxing CSP, and `attachment` for documents.

## Data model (Phase 2)

Defined in `prisma/schema.prisma` (MySQL/MariaDB), 28 tables.

| Area | Models |
| --- | --- |
| Accounts (Better Auth) | `User` (+ role, status, Google email, phone, city, preferred language), `Session`, `Account`, `Verification`, `RateLimit` |
| Courses | `Course` (one teaching language, bilingual listing, paid-ready fields), `CourseInstructor`, `CourseModule`, `Lesson` (video provider + link), `CourseResource` |
| Learning | `Enrollment` (REQUESTED → APPROVED/REJECTED/REVOKED), `LessonProgress`, `Certificate` (public code) |
| Communication | `Announcement`, `Notification`, `SupportTicket`, `SupportMessage` |
| Website content | `Post`, `Faq`, `Testimonial`, `CaseStudy` (consent flag required to publish), `SiteSetting` (key → JSON), `MediaAsset` |
| Leads | `Inquiry` (+ locale, UTM, follow-up, assignee), `InquiryNote`, `NewsletterSubscriber` |
| Oversight | `AuditLog` |

Integrity rules (verified by `src/test/schema.integration.test.ts`):
- One enrollment and at most one certificate per student per course.
- Courses with enrollments or certificates cannot be deleted; archive them (`status = ARCHIVED`).
- Media files referenced by a course resource cannot be deleted.
- Deleting a user removes their sessions, enrollments, progress, tickets and notifications; leads,
  audit entries, courses and posts they touched are kept with the reference cleared.
- Bilingual CMS text uses an English column plus an optional `…Ur` column.

## Internationalisation

- Locales: `en` (default, no URL prefix) and `ur` (`/ur`, right-to-left).
- Pages live under `src/app/[lang]/` and are statically generated for both locales.
- Components receive `locale` and `dict` props; links are built with `localizePath()`.
- Missing Urdu strings fall back to English wrapped in Unicode direction isolates, so they display correctly in RTL.
- Content written in one language (blog posts, and later courses) is marked with its own `lang`/`dir`.
- Use logical CSS utilities (`ps-`, `me-`, `start-`, `border-s`) instead of left/right so layouts mirror automatically.
- Known limitation: 404 responses are server-rendered as Next's error shell and completed in the browser
  (correct language, direction and content with JavaScript). They are `noindex`.

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
