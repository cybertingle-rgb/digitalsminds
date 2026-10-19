# Project Status: Decisions, Open Items, Progress

Living record for the Digitals Minds platform. Updated at every phase.
Last updated: 2026-10-19 (Phase 2 complete).

## Confirmed decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Hosting | Hostinger Node.js hosting, GitHub branch `claude/digitals-minds-web-foundation-ikhb2s`, live at digitalsminds.com (health check OK) |
| 2 | Stack | Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Prisma 7 + MySQL/MariaDB (Hostinger database), Zod |
| 3 | Build | `npm run build` uses webpack (Turbopack's PostCSS child process is blocked in Hostinger's build sandbox); `prebuild` applies migrations |
| 4 | Brand | Official logos supplied by owner (transparent PNG, dark JPG, light JPG). Colours from logo: yellow `#FDCF31`, charcoal `#2B323C`, logo text `#373643`. Logo used unaltered. |
| 5 | Visual direction | Light and clean, charcoal text, yellow accents/CTAs, dark charcoal footer |
| 6 | Contact | info@digitalsminds.com · 4th Floor, GM Plaza, Kohinoor Jaranwala Road, Faisalabad, Pakistan. **No phone or WhatsApp number anywhere on the site or in docs until the owner says otherwise.** |
| 7 | Course pricing | All free at launch; schema ready for paid courses later |
| 8 | Enrollment | Student requests access; an admin approves |
| 9 | Video | Owner's Google Drive links, **restricted to specific Google accounts**. Stored as provider + link so a lesson can switch to another host later. Embedded player + "Open in Google Drive" fallback. |
| 10 | Roles | Super Admin, Content Manager, Instructor (own courses only), Student |
| 11 | Editable content (launch) | Core: courses, blog, FAQs, testimonials, case studies, homepage hero + featured items, contact details, social links, logo, SEO metadata. Layouts stay developer-managed. |
| 12 | File storage | Verify Hostinger persistent storage first, then decide (see Open items) |
| 13 | Email | Hostinger mailbox via SMTP |
| 14 | Registration fields | Name, email, password, Google account email, phone/WhatsApp, city |
| 15 | Languages | English + Urdu for public site and student portal; admin UI English with Urdu content fields |
| 16 | Urdu text | Supplied by owner; English shown until a translation exists |
| 17 | Urdu font | Naskh (Noto Naskh Arabic), self-hosted |
| 18 | Course language | Each course is in one language; only catalogue listing text is bilingual |
| 19 | Launch features | Certificates of completion, support tickets, course announcements and notifications, newsletter sign-up (stored in own DB) |
| 20 | Analytics | GA4 with cookie consent banner + Google Search Console |
| 21 | Legal pages | Privacy Policy and Terms text supplied by owner. No refund policy while courses are free. |
| 22 | Testimonials / case studies | Owner has verified items ready (with client permission) |
| 23 | Authentication | Better Auth (self-hosted, stores users/sessions in MySQL), email/password + Sign in with Google |
| 24 | Urdu go-live | `/ur` stays noindex with the language switcher hidden (`features.urduPublic = false`) until the owner's Urdu translation is in place |
| 25 | App icon | Square icon made from the official dark logo (tight crop, unaltered artwork): favicon.ico, icon.png, apple-icon.png |
| 26 | Email library | `nodemailer` approved for SMTP sending (Phase 3) |
| 27 | Data model | 28-table schema (Phase 2). Learning history is archive-only; one enrollment/certificate per student per course |

## Open items (waiting on owner)

- [ ] **Hostinger plan name** and a File Manager screenshot of the home folder, to confirm persistent upload storage (blocks the media phase)
- [ ] Social media profile URLs
- [ ] Testimonials and case studies (text, name/role, photo if any, confirmation of permission)
- [ ] Privacy Policy and Terms & Conditions text
- [ ] Urdu translations (provided when the bilingual structure is ready)
- [ ] Later: GA4 Measurement ID, Search Console verification, Google Cloud OAuth client, SMTP mailbox credentials (set as Hostinger environment variables; never sent in chat)
- [ ] Approval to start Phase 3 (authentication). Before it can go live: a Hostinger mailbox for sending
      (e.g. noreply@digitalsminds.com) and a Google Cloud OAuth client; I'll give step-by-step instructions

## Assumptions (to confirm or correct)

- English is the default language; Urdu pages live under `/ur/...`.
- Only Super Admin can manage staff accounts, site settings and student data exports.
- Students can view course listings without logging in; lessons require an approved enrollment.
- Hostinger daily email limits are sufficient for launch volume.

## Completed work

| Date | Work | Commit |
| --- | --- | --- |
| 2026-10-19 | Next.js + Prisma foundation, secure inquiries API, health check | `90f1eb2` |
| 2026-10-19 | Marketing pages, components, inquiry form, SEO routes, security headers | `463c277` |
| 2026-10-19 | Setup, architecture, deployment and portal-plan docs | `d182638` |
| 2026-10-19 | Switched database to MySQL/MariaDB for Hostinger | `6d7653c` |
| 2026-10-19 | Fixed Hostinger build (webpack), migrations on build; verified live | `36e0118` |
| 2026-10-19 | Requirements discovery; this status file and roadmap | `129a355` |
| 2026-10-19 | Phase 1: official logos, brand colours, Urdu font, English/Urdu routing with RTL, restyled pages, phone numbers removed | `7a768f4` |
| 2026-10-19 | Phase 2: data model (28 tables) and additive migration, Better Auth installed, square app icon, DB integration tests, migration workflow fix (shadow DB) | `6309ab8` |
