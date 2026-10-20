# Digitals Minds Web App

**Learn | Grow | Earn**: A Complete Business Growth & Brand Development Initiative.

The public website and future platform for Digitals Minds, covering the five
divisions: Digital Marketing & Growth, Product Sourcing & Logistics, Media &
Content Production, Startup & Brand Setup, and Web & E-Commerce.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React Server Components), TypeScript |
| Styling | Tailwind CSS 4, with brand tokens in `src/app/globals.css` |
| Database | MySQL / MariaDB via Prisma 7 (`@prisma/adapter-mariadb`), versioned migrations |
| Validation | Zod 4, one schema shared by client and server |
| Tests | Vitest (unit + route handler tests) |

## Quick start

Requirements: Node.js 20.19+, 22.12+ or 24+ (22 recommended, see `.nvmrc`) and MySQL 8+ or MariaDB 10.6+.

```bash
npm install                  # also generates the Prisma client
cp .env.example .env         # then set DATABASE_URL etc.
npm run db:migrate           # apply migrations to your dev database
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (applies pending DB migrations first, see below) / server |
| `npm run lint` · `npm run typecheck` · `npm test` | Quality checks |
| `npm run db:migrate -- --name <change>` | Create + apply a migration and regenerate the client (development; needs `SHADOW_DATABASE_URL`) |
| `npm run test:db` | Database integration tests against `TEST_DATABASE_URL` (name must contain "test") |
| `npm run db:deploy` | Apply pending migrations (production) |

## Database changes (development)

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name <change>` with `SHADOW_DATABASE_URL` set to an empty scratch database.
   Without it, Prisma 7 generates migrations from an empty schema (`CREATE TABLE` for tables that already exist).
3. Review the SQL in `prisma/migrations/<timestamp>_<change>/migration.sql`: no `DROP`/`RENAME` without approval.
4. `npm run test:db`, then commit the schema and migration together.
5. On deploy, `npm run build` applies pending migrations (see Build notes).

## Build notes

- `npm run build` uses **webpack** (`next build --webpack`). Turbopack runs PostCSS/Tailwind in a child
  Node process that must connect back over TCP to `127.0.0.1`; restricted build sandboxes (such as
  Hostinger's) block that and the build crashes. Webpack processes CSS in-process.
- A `prebuild` step (`scripts/migrate-on-build.mjs`) runs `prisma migrate deploy` when `DATABASE_URL`
  is set. If the database is unreachable from the build machine it warns and continues; other
  migration errors (e.g. wrong password) fail the build. Set `SKIP_DB_MIGRATE=1` to disable it.

## Environment variables

See `.env.example`. **Never commit `.env`**; it is git-ignored.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes (runtime) | `mysql://USER:PASSWORD@HOST:3306/DATABASE` (URL-encode special characters in the password). Not needed for `next build`. |
| `NEXT_PUBLIC_SITE_URL` | Yes in production | Canonical URL, e.g. `https://digitalsminds.com`. Used for SEO, sitemap and origin checks. Set at **build** time. |
| `BETTER_AUTH_SECRET` | **Yes** (runtime) | 32+ random characters. Signs sessions and encrypts secrets saved in the admin panel. Never change it once live. |
| `ADMIN_SETUP_CODE` | Only for first setup | 16+ random characters for the one-time `/setup` page. Remove after setup. |
| `UPLOAD_DIR` | No | Upload folder outside the app (default `~/digitalsminds-uploads`). Verified in Admin → Integrations → File storage. |
| `TRUSTED_PROXY_HOPS` | No | Proxies in front of the app, for rate-limit IPs (default 1). |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Public email shown on the site; defaults to `info@digitalsminds.com`. Set at build time. |

No phone or WhatsApp number is displayed anywhere on the site (owner decision); there is no setting for one.
| `INQUIRY_WEBHOOK_URL` | No | Receives `{type:"inquiry.created", data}` JSON for each lead (Zapier/Make/Slack/CRM). |

## Content & branding

- **Logos:** official files in `public/brand/` (web versions) and `assets/brand/originals/` (as supplied). See `public/brand/README.md`.
- **Colours:** `@theme` block in `src/app/globals.css` (charcoal `#2B323C`, yellow `#FDCF31` from the logo).
- **Glass look:** utilities in `src/app/globals.css`: `glass` (cards), `glass-subtle` (callouts), `glass-strong` (forms),
  `glass-blur` (header/sidebar/rail), `glass-sun` (yellow call-to-action panels), `glass-ink` (small dark badges),
  `glow-card` (yellow glow + pointer spotlight on hover, via `GlowTracker`) and `border-run` (light running around a border).
  `AmbientBackground` draws the drifting glows (still on phones and with reduced motion); blur is lighter on phones; panels
  turn near-solid when blur isn't supported or reduced transparency is requested.
- **Preloader:** `src/components/effects/Preloader.tsx` (first page of each visit, switched on by an inline head script).
- **Social links:** Admin → Website (stored in `SiteSetting` `site.social`, read by the page via `/api/public/social`).
- **All page text:** `src/i18n/dictionaries/en.ts` (English) and `ur.ts` (Urdu). Services text lives there too.
- **Navigation, email, social links:** `src/config/site.ts`.
- **Blog posts:** `src/content/blog.ts` (each post has one language).

No testimonials, client logos or statistics are included. Add them only from verified sources.

## Accounts & admin

- Authentication: Better Auth (email/password with email verification, password reset, optional Google sign-in), sessions in MySQL.
- Roles: Super Admin, Content Manager, Instructor, Student (`src/modules/auth/permissions.ts`); every admin page and action checks permissions on the server.
- The Super Admin (`info@digitalsminds.com`) is created once at `/setup` using `ADMIN_SETUP_CODE`; the page then disappears.
- Email (SMTP) and Google sign-in are configured in **Admin → Integrations**; passwords/secrets are encrypted with a key derived from `BETTER_AUTH_SECRET`.
- Rate limits (per client IP): login 15/min, sign-up 5/10 min, password reset 3/10 min.
- Sensitive admin actions are written to the `AuditLog` table and shown in **Admin → Activity**.
- **Admin → Team** (Super Admin): invite staff by email (they set their own password via a 3-day link), change roles,
  suspend/reactivate (signs them out everywhere) and remove access. The owner account and the last active Super Admin are protected.
- Instructors are limited to their assigned courses (`src/modules/auth/scoping.ts`).

## Media uploads

- **Admin → Media**: images (JPG/PNG/WebP ≤ 8 MB) and documents (PDF/DOCX/XLSX/PPTX ≤ 25 MB), public or private.
- Files are identified by content (magic bytes); SVG, legacy Office and macro files are rejected. Images are re-encoded
  (EXIF/GPS removed, max 2560 px).
- Public files: `/media/<year>/<month>/<file>` (immutable cache). Private files: `/api/files/<id>` (access-checked, no cache).
- Files in use (course thumbnails/resources, blog covers, testimonials, case studies) cannot be deleted; "Replace" keeps links.
- Uploads stay **off** until Admin → Integrations → File storage confirms the folder survived a redeploy.

## Courses

- **Admin → Courses** (Super Admin, Content Manager, Instructor): create a course, then add modules and lessons, reorder them
  with the arrows, and open a lesson to add its Google Drive video link (live preview), formatted text, length, free-preview flag
  and resources (files from Media or https links). **Preview as student** shows the course exactly as learners will.
- Instructors see and edit only the courses they're assigned to; a Content Manager or Super Admin assigns instructors and
  publishes, unpublishes or archives courses. Publishing requires at least one lesson, no empty modules and valid video links.
- Videos stay private in Google Drive: share each video with the enrolled student's Google email.
- Once published, a course's web address is locked; courses with students can be archived but not deleted.

## Students and enrollment

- **Courses** (public): catalogue and course pages with objectives, contents and free-preview lessons.
- Students create an account, then **Request access** with the Google email their videos should be shared with.
  The team is emailed (lead-alert address) and the request appears in **Admin → Enrollments** with the Google email
  ready to copy and links to the course's Drive videos. Approving or rejecting emails the student.
- **My learning** (`/account`): enrolled courses with progress and "Continue", request status, profile editing.
- Lessons: Drive player with "Open in Google Drive", formatted text, resources (private files only for enrolled
  students), "Mark as complete", course progress. Lessons can be opened in any order.
- Revoking access ends it immediately (also remove the student from the Drive sharing). Archived courses stay open to
  students already enrolled.

## Student management

- **Admin → Students** (Super Admin, Content Manager): search by name, email, phone or city; filter by enrollment, course
  and account status. Profiles show courses with progress and last viewed lesson, the Google email to copy, and a history.
- Staff who approve enrollments can **enroll a student directly** (they get the approval email) and approve/revoke from the profile.
- Super Admin only: edit a student's details (e.g. fix a mistyped Google email), suspend/reactivate (signs them out
  everywhere; progress is kept), and **Export CSV** (honours filters, logged in Activity).

## Languages

- English is served at `/…`, Urdu at `/ur/…` (right-to-left, Noto Naskh Arabic font, self-hosted).
- `src/proxy.ts` routes requests: unprefixed paths render the English pages, `/en/…` redirects to the unprefixed URL.
- Untranslated Urdu text falls back to English automatically.
- `features.urduPublic` (`src/config/features.ts`) is **off** until the translation is complete: the language
  switcher is hidden and `/ur` pages are `noindex` and left out of the sitemap, but can be previewed at `/ur`.

## Leads

- **Admin → Inquiries** (Super Admin, Content Manager): search; filter by status (spam hidden by default), service, assignee and
  follow-up (overdue / today / upcoming, Pakistan time); detail page with status, assignee, follow-up date and a notes timeline.
- Each inquiry records the page it came from, the site language and campaign tags (`utm_source/medium/campaign`, kept in the
  visitor's sessionStorage only, no cookies).
- **Lead alert emails** for every new inquiry (default `info@digitalsminds.com`, changeable on the Inquiries page; needs Email set up).
- **CSV export** (Super Admin only, honours filters, logged in Activity; formula cells are neutralised). Deleting a lead is Super Admin only.
- `INQUIRY_WEBHOOK_URL` can still forward each lead to Zapier/Make/a CRM.

## Further docs

- [Architecture](docs/ARCHITECTURE.md): structure, request flow, security model
- [Deployment](docs/DEPLOYMENT.md): Vercel, Node/VPS, cPanel Node.js hosting
- [Student Portal plan (Phase 2)](docs/STUDENT_PORTAL.md)
