# Project Status: Decisions, Open Items, Progress

Living record for the Digitals Minds platform. Updated at every phase.
Last updated: 2026-10-20 (Phase 13 complete; launch checklist with the owner).

## Confirmed decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Hosting | Hostinger Node.js hosting, GitHub branch `claude/digitals-minds-web-foundation-ikhb2s`, live at digitalsminds.com (health check OK) |
| 2 | Stack | Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Prisma 7 + MySQL/MariaDB (Hostinger database), Zod |
| 3 | Build | `npm run build` uses webpack (Turbopack's PostCSS child process is blocked in Hostinger's build sandbox); `prebuild` applies migrations |
| 4 | Brand | Official logos supplied by owner (transparent PNG, dark JPG, light JPG). Colours from logo: yellow `#FDCF31`, charcoal `#2B323C`, logo text `#373643`. Logo used unaltered. |
| 5 | Visual direction | White and light-yellow glassmorphism (owner choice, Oct 2026): frosted glass panels with a light-yellow tint over slowly drifting brand glows (still on phones and for reduced motion); glowing yellow hover on cards, nav and buttons; floating glass header (full menu from 1280px), glass footer and admin sidebar; yellow-glass call-to-action panels; content up to 1680px with slim side margins |
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
| 28 | Super Admin | info@digitalsminds.com, created once via /setup with ADMIN_SETUP_CODE (proof of hosting access) |
| 29 | Email settings | SMTP (noreply@digitalsminds.com, created by owner) configured in Admin → Integrations, password encrypted |
| 30 | Google settings | OAuth client created by owner and entered in Admin → Integrations → Google, "Connect & test", then enabled for students |
| 31 | Package versions | Pin releases at least ~2 weeks old for security-critical deps (better-auth 1.7.7, nodemailer 10.0.14) |
| 32 | Team rules | Only Super Admins manage the team; owner account (info@) can't be demoted/suspended; at least one active Super Admin; nobody changes their own access |
| 33 | Staff invites | Email link (valid 3 days) to set a password; inviting an existing student promotes that account |
| 34 | Hosting plan | Hostinger Business Web Hosting (50 GB disk, 600k inodes, shared by 6 sites, 3 GB RAM, Frankfurt) |
| 35 | File storage | Uploads on the Hostinger account disk, outside the app (`~/digitalsminds-uploads` or `UPLOAD_DIR`); enabled only after a redeploy proves persistence. Videos stay on Google Drive |
| 36 | Leads | Super Admin + Content Manager manage leads; CSV export and deletion Super Admin only; alert emails default to info@digitalsminds.com; campaign tags kept in sessionStorage (no cookies) |
| 37 | Newsletter | Subscriber list/export built together with the public sign-up form (and email confirmation) in Phase 10 |
| 38 | Course publishing | Instructors create and edit their own courses; only Content Managers and Super Admins publish, unpublish or archive. Publishing needs a lesson in every module and valid video links |
| 39 | Lesson text | Simple formatting (paragraphs, headings, bullets, links), stored as plain text and never rendered as HTML |
| 40 | Course videos | Google Drive links only (the app builds the player URL from the file ID); reordering with up/down buttons |
| 41 | Lesson order | Students may open lessons in any order; completion still needs every lesson |
| 42 | Enrollment approvals | Super Admin + Content Manager approve/reject/revoke; instructors see their course roster read-only |
| 43 | Google email | Required on every access request (prefilled from the profile), saved to the student's profile |
| 44 | Request alerts | Email to the lead-alert address (default info@digitalsminds.com) plus a waiting count on the dashboard |
| 45 | Learning access | Completion is a "Mark as complete" button; revoking or unpublishing ends access immediately; archived courses stay open to enrolled students |
| 46 | Student management | Super Admin + Content Manager view students; enrollment staff can enroll directly; editing, suspending and CSV export are Super Admin only. Super Admin can permanently delete an account for a privacy request (email typed to confirm; audit log keeps counts, not personal data) |
| 47 | Social links | Facebook, Instagram, LinkedIn shown as an expanding icon rail on the right (tablet/desktop) and in the footer; links pasted by the owner in Admin → Website (validated official URLs) |
| 48 | Preloader | Neon-glow logo preloader on the first page of each visit (about 1 s, max 2.5 s); never shown without JavaScript |
| 49 | Home content | Adds live courses, division details, "Why Digitals Minds", FAQ and testimonials (published + consent only). Why-us and FAQ wording drafted from confirmed facts: **owner to approve** |
| 50 | Certificates | Printable A4 certificate page (browser "Save as PDF"), no PDF library; issued after staff review (Super Admin, Content Manager); public verification shows name, course, date and ID only |
| 51 | Support | Super Admin + Content Manager see all requests; instructors see requests about their own courses; internal notes are staff-only |
| 52 | Newsletter | Footer sign-up with email confirmation; list for Super Admin + Content Manager; CSV export and removal Super Admin only. Sending newsletters is a later option |
| 53 | Content editing | Simple formatting (no visual editor library) with images from Media; draft/publish switch on every item; Super Admin + Content Manager edit content; logo replaceable by Super Admin only |
| 54 | Legal pages and home text | Owner asked us to write them: built-in Privacy Policy and Terms & Conditions (effective 2026-10-20, Pakistan law, Faisalabad courts) are published by default and can be edited in Admin → Website → Legal pages; "Why Digitals Minds" and 8 FAQs finalised without promised response times |
| 55 | Hostinger build | Next.js build limited to 2 workers (shared hosting thread limit); Node.js 22 recommended |
| 56 | Analytics and consent | GA4 loads only after a visitor presses "Accept analytics" (Consent Mode, ads signals always denied); banner shown only once a Measurement ID is saved; "Cookie settings" link in the footer; events: inquiry, newsletter sign-up, course access request, without personal details |
| 57 | Structured data | Organization (Faisalabad address, email, logo, social links), WebSite, FAQ, blog posts, courses, services and breadcrumbs; no ratings, reviews or phone numbers |
| 58 | Backups | Super Admin downloads (Admin → Backups): database as .sql.gz (restorable with phpMyAdmin), uploaded files as .tar.gz; plus Hostinger automatic backups; restore drill tested (docs/BACKUP.md) |
| 59 | Security review | Findings fixed (open redirect, per-account auth limits, email greeting, profile validation, newsletter, delete permissions); accepted risks in docs/SECURITY_REVIEW.md |
| 60 | eBay course focus | Owner request: the homepage opens with the paid eBay course (editable "Featured course" in Admin → Website → Homepage, can be switched off). "Enroll" opens the contact form with "eBay course enrollment" selected; leads arrive in Inquiries. Official eBay logo used at the owner's request via Media upload, with a "not affiliated with or endorsed by eBay" note. Courses wording, FAQ and Terms updated for paid courses |
| 61 | Paid courses | PKR only. Students pay by bank transfer, JazzCash or EasyPaisa and send the transaction ID + receipt (image or PDF, stored privately outside the Media library); only Super Admins set prices, enter account details and confirm/reject payments; Content Managers can view. Confirming opens the course (usual access email); rejecting emails the reason and the student can resend. Card gateway is a later option |

## Open items (waiting on owner)

- [ ] File storage: Admin → Integrations → File storage → Run check, redeploy, Run check again (enables uploads); confirm Hostinger backups include the upload folder
- [ ] Social media links: paste Facebook, Instagram and LinkedIn URLs in Admin → Website
- [x] "Why Digitals Minds" and FAQ text written (owner delegated); editable in Admin → Website (Homepage, FAQs)
- [ ] Switch Hostinger to Node.js 22 (Deployments → Build and output settings) and redeploy
- [ ] Send verified testimonials (name, role/company, quote, photo if any, permission)
- [ ] Testimonials and case studies (text, name/role, photo if any, confirmation of permission)
- [x] Privacy Policy and Terms & Conditions written and published (owner delegated); have them reviewed by a lawyer when convenient
- [ ] Urdu translations (provided when the bilingual structure is ready)
- [ ] eBay logo: download it from the Wikimedia link, upload in Admin → Media (public), choose it in Admin → Website → Homepage → Featured course
- [ ] Payments: enter your bank / JazzCash / EasyPaisa details in Admin → Payments → Payment details
- [ ] eBay course: create it in Admin → Courses, set its price (Price box), publish, then set the homepage button link to /courses/<its address> (Admin → Website → Homepage → Featured course)
- [ ] eBay course details: name, what it covers (points), length, language, fee and how payment works; then create the course in Admin → Courses
- [ ] Launch checklist: docs/LAUNCH.md (production settings, tests on the live site, uptime monitor on `/api/health`)
- [ ] Weekly backups from Admin → Backups, stored privately (docs/BACKUP.md)
- [ ] Ask Hostinger support whether requests pass through more than one proxy (only if yes: set `TRUSTED_PROXY_HOPS`)
- [ ] Google Analytics: create a GA4 property (Web data stream for https://digitalsminds.com), paste the Measurement ID (G-...) in Admin → Website → Analytics
- [ ] Search Console: add the URL-prefix property https://digitalsminds.com, choose "HTML tag", paste it in Admin → Website → Analytics, press Verify, then submit `sitemap.xml`
- [x] Hostinger env vars set and `/setup` completed (owner confirmed login and setup work)
- [x] Replaced `BETTER_AUTH_SECRET` (owner confirmed). Re-enter the SMTP password / Google secret in Integrations if they were saved before the change
- [x] Removed `ADMIN_SETUP_CODE` from Hostinger (owner confirmed)
- [ ] Set up Email in Admin → Integrations; reset the temporary owner password via "Forgot password"
- [x] Approval to start Phase 7 (course creation and publishing)
- [x] Approval to start Phase 8 (catalogue, enrollment requests and approvals, student dashboard, lesson player)
- [x] Approval to start Phase 9 (student management: search, profiles, suspend/reactivate, manual enroll, exports)
- [x] Approval to start Phase 10 (announcements, notifications, support tickets, certificates, newsletter)
- [x] Approval to start Phase 11 (website content management)
- [x] Approval to start Phase 12 (SEO, analytics with consent, performance and accessibility; needs GA4 Measurement ID and Search Console access)

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
| 2026-10-19 | Phase 3: Better Auth (email/password, verification, reset, Google), one-time /setup, admin shell with Integrations (encrypted SMTP + Google), permission matrix, audit log, IP-safe rate limiting, 47-check e2e run | `7776223` |
| 2026-10-19 | Phase 4: Team management, Activity log page, instructor scoping, Drive CSP; fix: missing/short auth secret no longer breaks the contact form and health check | `e5d6608` |
| 2026-10-19 | Phase 5: media library (uploads with progress, content validation, EXIF stripping, public/private serving, replace, in-use protection, instructor scoping), File storage persistence check | `58e6224` |
| 2026-10-19 | Phase 6: live dashboard, Inquiries (filters, detail, status/assignee/follow-up, notes, delete), lead alert emails, UTM/language capture, safe CSV export | `ee1d546` |
| 2026-10-19 | Phase 7: course editor, curriculum (modules/lessons, reordering), Drive video links with preview, resources, instructors, publishing checklist and permissions, student preview, 53-check e2e run | `cb36e7c` |
| 2026-10-19 | Phase 8: course catalogue and pages, free previews, access requests and Enrollments queue, approval/rejection emails, My learning dashboard and profile, lesson player with progress, private files for students, 45-check e2e run | `6008c4d` |
| 2026-10-20 | Phase 9: student list, search and filters, profiles with progress and history, manual enrollment, edit/suspend (Super Admin), CSV export, 31-check e2e run | `4026856` |
| 2026-10-20 | Glass design v1 and v2 (owner request): glass UI, floating header, new footer, social rail, preloader, richer home | `0ba1984`, `b31f3dd` |
| 2026-10-20 | Phase 10: notifications, announcements, support tickets, certificates with review and verification, newsletter with double opt-in, 37-check e2e run | `e033e49`, `8b12b97` |
| 2026-10-20 | Phase 11: website content management (homepage, blog, FAQs, testimonials, case studies, legal pages, SEO, contact, logo), 27-check e2e run | `958b3ba` |
| 2026-10-20 | Published Privacy Policy and Terms, final Why-us/FAQ text, privacy account deletion; Hostinger build fix (2 build workers) | `2421be9` |
| 2026-10-20 | Phase 12: structured data, GA4 behind a consent banner with events, Search Console verification, robots rules, WCAG 2.1 AA audit (no violations), login/password-form fixes, 28-check e2e run | `08eec38` |
| 2026-10-20 | Phase 13: Admin → Backups (database .sql.gz + files .tar.gz) with a tested restore drill, security review and fixes, dependency audit, launch checklist and maintenance runbook | `1ffc2f4` |
