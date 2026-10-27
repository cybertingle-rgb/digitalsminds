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

## Enrollment platform (Phases 15-19)

Digitals Minds is a paid enrollment and student administration platform; online lessons were retired
(docs/ENROLLMENT.md has the full workflow and permission table).

- `src/modules/batches/`: batches, seat counting (`SEAT_STAGES`), availability rules (`rules.ts`, pure and unit-tested), coordinator scope (`canCoordinate`).
- `src/modules/admissions/`: applications, private status-link tokens (random 32 bytes, SHA-256 stored, httpOnly `dm_app` cookie set by `/api/applications/open`), payment submission, **verification transaction** (marks the payment once, locks the batch row with `SELECT … FOR UPDATE`, checks seats, creates/reactivates the user, creates/updates the enrollment, closes the application; any failure rolls everything back). Duplicate transactions are blocked by a normalised SQL comparison and a unique `Payment.verifiedKey`.
- `src/modules/portal/`: the student's own enrollments, onboarding (auto-advance Confirmed → Onboarding → Active), documents and notices, all scoped to their current batches.
- `src/modules/enrollments/`: staff stage changes, transfers and withdrawals (seat checks under a row lock), staff-confirmed onboarding steps, rosters.
- `src/modules/onboarding/`: checklist items and private student documents (`documents/` storage prefix).
- `src/modules/live/`: batch schedule (CLASS / HOLIDAY / EVENT), reminders, calendar files.
- Sign-up: Better Auth `disableSignUp` for email and Google, plus a `user.create.before` hook that refuses any account created through the auth API.
- Public routes: `/courses/[slug]` (batches), `/courses/[slug]/apply`, `/application` (status page), `/refund-policy`; APIs: `/api/applications` (apply), `/open`, `/payment`, `/link`, `/api/applications/[id]/cv` (Super Admin), `/api/documents/[id]`.
- Admin routes: Applications, Batches (roster), Schedule (`/admin/live-classes`), Announcements, Onboarding, Documents; CSV exports at `/api/admin/applications/export` and `/api/admin/batches/[id]/export`.

## Catalogue, time zones, attendance (Phases 21-25)

- `src/modules/catalog/`: program categories and services (Prisma `ProgramCategory`, `Service`). Services are copied from
  `src/content/service-defaults.ts` into the database once (flag `catalog.servicesSeeded`); public pages read
  `siteServices()`, which falls back to that text if the database is unreachable (e.g. at build time). Inquiry topics are
  any published service slug or a fixed topic (`general`, `training`); the API route checks it.
- Prices are PKR only (`formatPkr`); the currency conversion added in phase 23 was removed at the owner's request.
- `src/lib/timezone.ts`: Intl-based zone conversion (`zonedToUtc` handles DST gaps/overlaps), labels. Batches store an
  IANA zone; `createLiveClass`/`updateLiveClass` read the entered date/time in it.
- `src/modules/attendance/`: per-class marks (`Attendance`, unique per class + enrollment) for batches with
  `attendanceEnabled`; `canCoordinate` scopes staff; students read only their own.
- `src/components/effects/Preloader.tsx` + `globals.css` (`dm-pl-*`): first-visit preloader (CSS transforms/opacity,
  inline SVG icons, the logo from `getLogos()`); `NavigationProgress.tsx`: top bar for slow in-site navigations (10 s cap).

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

## Live classes (Phase 14c, now per batch: see Enrollment platform)

- `LiveClass` table (additive migration `phase14_live_classes`). `src/modules/live/service.ts`: course staff
  (`canManageCourse`) schedule/edit/cancel; times entered in PKT, stored UTC; meeting links limited to Zoom, Google
  Meet and Teams over https, shown only to approved students and course staff; `.ics` at `/api/live/[id]/ics`.
- Reminders: `sendDueReminders()` claims each 1-day / 1-hour reminder in the database before emailing + notifying,
  so it is sent once. It runs every 5 minutes inside the server (`src/instrumentation.ts` →
  `src/modules/live/scheduler.ts`; `LIVE_REMINDER_INTERVAL_MS` to change, minimum 30 s). Moving a class re-arms them.
- Admin: `/admin/live-classes`. Student: `/account/live` (Join from 15 minutes before; add to calendar) and a
  "Next live class" card on the dashboard.

## Student portal (Phase 14b)

- `src/app/[lang]/(marketing)/account/layout.tsx`: portal shell (sidebar on large screens, scrolling tabs on phones)
  around every `/account` page; signed-out visitors get the page alone, which redirects to login with the right `next`.
- Pages: Dashboard (`/account`: stats, continue card, progress, recent activity, requests/payments, announcements),
  My courses, Certificates, Notifications, Support, Profile. Data: `src/modules/learning/dashboard.ts` (only the
  student's own records; learning time = sum of lengths of completed lessons).

## Paid courses (Phase 14a)

- `Payment` table (additive migration `phase14_payments`); amounts in paisa, PKR. `src/modules/payments/service.ts`:
  prices (`payments.manage`), account details (`site.payments`, shown only on `/courses/[slug]/pay` to signed-in
  students), `submitPayment` (validates receipt by content; images re-encoded; stored under `receipts/` in the upload
  folder, not in MediaAsset), `confirmPayment` / `rejectPayment` (Super Admin) which drive the enrollment via
  `decideEnrollment(..., { paymentConfirmed: true })`.
- Guards: free-request flow refuses paid courses; approving or manually enrolling into a paid course needs a confirmed
  payment or `payments.manage`. Receipts: `/api/payments/[id]/receipt` for the payer and `payments.view` only.
- Admin: `/admin/payments` (list, detail with receipt, confirm/reject), `/admin/payments/settings`. Student: payment
  status on My learning. Account deletion also removes receipt files.

## Backups and hardening (Phase 13)

- `src/modules/backup`: `sqlDump()` streams a mysqldump-style file (DROP/CREATE + batched INSERTs ordered by primary
  key; Session, Verification and RateLimit structure only) and `tarArchive()` streams the upload folder as ustar;
  both are gzipped on the fly by `/api/admin/backup/{database,media}` (`backups.download`, Super Admin, audited).
  Admin page: `/admin/backups`. Runbook and the tested restore drill: docs/BACKUP.md.
- Auth route adds per-account limits (sign-in 50/h, sign-up/reset/verification email 3/h per email) on top of
  Better Auth's per-IP limits. `safeNext` rejects control characters/backslashes and checks the resolved origin.
- Findings and accepted risks: docs/SECURITY_REVIEW.md.

## SEO, analytics, accessibility (Phase 12)

- Structured data (`src/modules/seo/structured-data.ts`, rendered by `<JsonLd>`, escaped against `</script>`):
  Organization + WebSite on the homepage (address from `siteConfig.postalAddress`, email, logo, `sameAs` social links),
  FAQPage (homepage FAQs), BlogPosting, Course (published only), Service, and BreadcrumbList on detail pages. No ratings,
  reviews, prices or phone numbers.
- `site.analytics` setting (Admin → Website → Analytics, `settings.manage`): GA4 Measurement ID and the Search Console
  HTML-tag code (rendered as `<meta name="google-site-verification">` by the root layout).
- Consent (`src/components/analytics`): `CookieConsent` asks only when a Measurement ID is set; the choice is kept in
  `localStorage` (`dm_consent`). gtag.js is injected only after "Accept", with Consent Mode defaults denied and only
  `analytics_storage` granted. "Cookie settings" in the footer reopens it; withdrawing deletes `_ga*` cookies. Events via
  `track()`: `generate_lead` (service slug), `sign_up` (newsletter), `enrollment_request` (course id), never personal data.
  Admin pages never load analytics. CSP allows only googletagmanager.com and the google-analytics.com collectors.
- robots.txt disallows `/admin`, `/account`, `/learn`, `/setup`, `/api/`; those pages are also `noindex`.
- Password forms use `method="post"`, so a submit before JavaScript loads never puts credentials in the URL.

## Website content management (Phase 11)

- `src/modules/content/settings.ts`: SiteSetting-backed content with built-in fallbacks: `site.home` (hero, why-us, CTA; EN+UR),
  `site.contact`, `site.seo` (per-page title/description/share image), `page.privacy` / `page.terms`, `site.logo`
  (replacement logos from Media; Super Admin). Reads are per-request cached and never throw (DB down -> built-in text).
- `src/modules/content/items.ts`: FAQs (import built-ins once; built-ins shown until then), testimonials and case studies
  (publishing requires recorded consent), up/down ordering. `src/modules/content/blog.ts`: posts in the database with
  draft/published/scheduled; built-in posts in `src/content/blog.ts` are shown until the first DB post exists (import button).
- Rich text gained images: `![alt](/media/...)` on its own line, only from this site's public Media files.
- Caching: the `[lang]` root layout revalidates every 60 s; every save calls `revalidatePath("/[lang]", "layout")` so edits
  appear at once. Admin: `/admin/website` with tabs (content.manage; Logo and Analytics need settings.manage).

## Communication, support, certificates, newsletter (Phase 10)

- `src/modules/notifications/service.ts`: in-app notifications (stored ready to show; links localised when rendered). Created for
  enrollment decisions, announcements, support replies and certificates; never fail the action that caused them.
- `src/modules/announcements/service.ts`: all-students (`announcements.site`) or one course's students (course managers).
  Optional email runs after the response (`after()`) and is claimed once (`emailSentAt`) so it can't double-send.
- `src/modules/support/service.ts`: tickets + threaded messages; `supportScope` = all tickets (`support.manage.all`) or tickets
  about the instructor's courses (`support.manage.own`). Internal notes never reach students. New tickets/replies email the
  lead-alert address and the course's instructors; staff replies email + notify the student. Per-account rate limits.
- `src/modules/certificates/service.ts`: staff review queue (`certificates.issue`); IDs `DM-XXXX-XXXX` (no look-alike
  characters); a re-issue after revocation gets a new ID. Public page `/certificates/[code]` (name, course, date, ID only;
  noindex) is also the printable A4 certificate (print CSS); `/verify` looks IDs up.
- `src/modules/newsletter/service.ts`: double opt-in. Pending sign-ups live in `Verification` (keyed by a hash of the emailed
  token, 3 days); confirming creates the `NewsletterSubscriber`. Confirm/unsubscribe pages use a button (email link scanners
  can't act). `POST /api/newsletter` (same-origin, rate-limited, honeypot, never reveals existing subscribers).

## Student management (Phase 9)

- `src/modules/students/service.ts`: search/filters → Prisma `where` (role STUDENT only), profile with per-course progress and
  history (audit entries for the user and their enrollments), edit details and suspend/reactivate (`students.manage`,
  Super Admin; suspending deletes sessions), export rows. Edits audit the changed field names, never the values.
- Manual enrollment: `manualEnroll` in `src/modules/learning/enrollment.ts` (`enrollments.decide`; active students, non-draft courses).
- Routes: `/admin/students`, `/admin/students/[id]`, `GET /api/admin/students/export` (`students.export`, CSV with formula guard).

## Learning: catalogue, enrollment, progress (Phase 8, retired in Phase 15)

- `src/modules/learning/catalogue.ts`: published-course listing (Urdu title/summary fall back to English), course loader.
- `src/modules/learning/enrollment.ts`: request → approve/reject, approve → revoke, rejected/revoked → approve or re-request.
  Decisions need `enrollments.decide` (Super Admin, Content Manager). Request alerts go to the lead-alert address; students
  get approval/rejection emails in their preferred language. Emails are best effort.
- `src/modules/learning/progress.ts`: `learnerContext` decides the mode on every request: `student` (approved and course
  published or archived), `staff` (manages the course; nothing recorded), `preview` (free-preview lessons of a published
  course, anyone). Revoking access or moving a course back to draft takes effect immediately. Completion is a
  "Mark as complete" button (Drive embeds don't report watch progress); `Enrollment.completedAt` records the first full completion.
- Private resource files (`/api/files/[id]`): staff as before, plus approved students of a published/archived course using the file.
- Routes: `/courses`, `/courses/[slug]`, `/learn/[slug]` (continue), `/learn/[slug]/[lessonId]`, `/account` (My learning + profile),
  `/admin/enrollments`. The sitemap lists published courses (generated per request).

## Courses (Phase 7, now Programs; curriculum retired in Phase 15)

- `src/modules/courses/service.ts`: course CRUD, curriculum (modules/lessons with up/down reordering and move-to-module),
  resources, instructors, publishing. Every function re-checks `canManageCourse` (Instructors: assigned courses only);
  publish/unpublish/archive need `courses.publish` (Content Manager, Super Admin) and the publishing checklist.
- Rules: the web address (slug) locks once a course was first published; only unused drafts can be deleted (otherwise archive);
  lessons/modules with student progress can't be deleted; thumbnails must be public images and resource files must come from
  the user's own media scope.
- `src/modules/courses/drive.ts`: only Google Drive file IDs are stored; the embed URL is built by the app
  (`https://drive.google.com/file/d/<id>/preview`), so pasted links can never put arbitrary pages in an iframe.
- `src/modules/courses/richtext.tsx`: "simple formatting" (paragraphs, `## ` headings, `- ` bullets, auto-linked https URLs)
  rendered as React elements, never as HTML.
- Admin UI: `src/app/[lang]/admin/courses/` (list, new, editor, lesson editor, student preview). Server actions in `actions.ts`.

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
