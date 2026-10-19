# Implementation Roadmap

Status: **draft, awaiting owner approval.** Decisions referenced (D#) are in `docs/PROJECT_STATUS.md`.
Each phase ships as its own commits on the deployment branch, is verified locally (lint, typecheck,
tests, production build, browser checks) and on Hostinger before the next phase starts. Database
changes are additive migrations only; anything destructive is proposed and approved first.

Complexity: S (≤1 day) · M (2–4 days) · L (1–2 weeks of focused work).

## Launch scope vs later

**Essential for launch:** Phases 1–13.
**Later / optional (not built until prioritised):** Phase 14.

---

## Phase 0: Discovery and audit ✅
Repository and hosting audit, build failure fixed and verified live, requirements confirmed (D1–D23).

## Phase 1: Brand design system and bilingual foundation (M) ✅
- **Objectives:** apply the real brand and make every page work in English and Urdu.
- **Deliverables:**
  - The official logo in header, footer, favicon and social preview.
  - Brand colour tokens, typography and the Naskh Urdu font, self-hosted.
  - Locale routing: `/` for English, `/ur` for Urdu, with a language switcher.
  - Right-to-left layout support and translation dictionaries.
  - Restyled existing pages and contact details in the footer.
- **Dependencies:** logo files (received). No new library: dictionary-based i18n per the Next.js docs.
- **Risks:** RTL edge cases in components; SEO needs `hreflang` and canonical links per language.
- **Testing:** visual checks in both directions on mobile and desktop, accessibility contrast check, build.
- **Acceptance:**
  - Every existing page renders correctly in `en` and `ur`; Urdu falls back to English text where no translation exists.
  - Logo is unaltered and sharp; there is no layout shift.
- **Checklist:** ☐ tokens ☐ logo assets ☐ fonts ☐ locale routing ☐ RTL ☐ switcher ☐ hreflang ☐ pages restyled ☐ tests

## Phase 2: Data model and migrations (M) ✅
- **Objectives:** one coherent schema for the whole launch scope.
- **Deliverables:**
  - **People:** User, Role, Better Auth tables.
  - **Courses:** Course, Module, Lesson (video provider + link), Resource, Enrollment (requested/approved/rejected/revoked), LessonProgress, Certificate.
  - **Communication:** Announcement, Notification, SupportTicket + messages.
  - **Website content:** Post, FAQ, Testimonial, CaseStudy, SiteSetting, MediaAsset.
  - **Leads and audit:** NewsletterSubscriber and AuditLog; Inquiry gains notes, follow-up date, assignee and UTM source.
  - Paid-ready fields (price, currency, access type) unused at launch. Bilingual content fields where D11/D18 require them.
- **Dependencies:** Phase 1 locale model.
- **Risks:** the existing Inquiry table and live data must be preserved; migration is additive only.
- **Testing:** migrate a copy of production-shape data, then roll forward on fresh and existing databases.
- **Acceptance:** `migrate deploy` succeeds on Hostinger and existing inquiries are intact.

## Phase 3: Authentication and account recovery (M)
- **Objectives:** secure sign-up and sign-in for students and staff.
- **Deliverables:**
  - Better Auth with email/password and Sign in with Google (captures the Google email for Drive sharing).
  - Email verification and password reset via Hostinger SMTP.
  - Registration fields (D14), login rate limiting and lockout, session management.
  - Bilingual auth pages.
- **New dependencies (approved):** `better-auth`. **To approve:** `nodemailer` for SMTP.
- **Owner inputs:** SMTP mailbox credentials and a Google Cloud OAuth client, both entered as Hostinger env vars.
- **Risks:** email deliverability (SPF/DKIM DNS on Hostinger); OAuth redirect URLs per environment.
- **Testing:**
  - Unit tests on validation.
  - End-to-end tests: register, verify, login, reset, Google login, rate limit.
- **Acceptance:** no account can sign in unverified; reset links expire; passwords are hashed and never logged.

## Phase 4: Roles, permissions and security controls (M)
- **Deliverables:**
  - A permission matrix for the 4 roles (D10), with server-side `requireRole`/`requirePermission` on every admin page, action and API.
  - Instructors are scoped to their own courses.
  - Audit log for sensitive actions.
  - CSP updated for Google Drive, Google sign-in and GA.
  - Admin route protection in `proxy.ts`, plus checks in the data layer.
- **Testing:** an automated authorisation test per role per endpoint (deny by default).
- **Acceptance:** a Student or Instructor cannot reach or call anything outside their permissions, even with crafted requests.

## Phase 5: Media and file storage (M), blocked until Hostinger storage is confirmed
- **Deliverables:**
  - Upload pipeline with type/size validation, image processing and preview, and progress and error feedback.
  - Organised folders and a MediaAsset record with metadata.
  - Safe replace/delete, access-checked delivery for private PDFs, and a backup plan.
- **Options:** Hostinger persistent folder outside the app (no cost), or object storage (asks first if paid).
- **Risks:** files inside the app folder are wiped on redeploy; this is why storage must be confirmed.
- **Acceptance:**
  - Uploads survive a redeploy.
  - Private files are unreachable without an approved enrollment.
  - Disallowed file types are rejected.

## Phase 6: Admin dashboard and lead management (M)
- **Deliverables:**
  - Admin shell (English UI) and a dashboard showing only real counts and recent activity.
  - Inquiries with search, filters, status, notes, follow-up dates, service category, source and CSV export (Super Admin).
  - Newsletter subscriber list and export.
- **Acceptance:** every number is a live database query; empty states appear when there's no data.

## Phase 7: Course creation and publishing (L)
- **Deliverables:**
  - A course editor (draft → published → archived) with thumbnail, objectives, prerequisites, level, language, duration and access type.
  - Modules and lessons with drag-and-drop reordering, Drive video link validation and resources.
  - Preview as a student, and instructor assignment.
- **Risks:** restricted Drive embeds may not play in Safari/iOS, so the editor shows the fallback and a sharing reminder.
- **Acceptance:** a non-technical admin can create and publish a course with modules, lessons and resources without help.

## Phase 8: Enrollment, student dashboard and learning (L)
- **Deliverables:**
  - Public course catalogue and detail pages (bilingual listing).
  - "Request access" flow, and an admin approval queue showing each student's Google email ready for Drive sharing.
  - Approval and rejection emails.
  - Student dashboard: enrolled courses, progress, continue-learning.
  - Lesson player with Drive embed and fallback, resources, lesson completion and progress bars.
  - Profile and enrollment history.
- **Acceptance:**
  - Students see only approved courses.
  - Progress persists across devices.
  - Revoking access removes it immediately.

## Phase 9: Student management (M)
- **Deliverables:** student search and profiles; enrollments and progress; suspend/reactivate; manual enroll/revoke; permitted exports. Audit log entries for each action.

## Phase 10: Announcements, notifications, support and certificates (M)
- **Deliverables:**
  - Course announcements, shown in the portal and optionally by email.
  - Notification centre.
  - Support tickets with threaded replies and email alerts.
  - Certificates generated on completion, with a public verification page by certificate ID.
- **To approve:** a PDF library for certificates (e.g. `pdf-lib`).
- **Acceptance:** a certificate can't be issued for an incomplete course, and its verification page shows only what you approve.

## Phase 11: Website content management (L)
- **Deliverables:**
  - Admin editing (EN + UR fields) for homepage hero and featured items, FAQs, testimonials, case studies, blog (the existing post migrated to the database), contact and social settings, logo, and SEO title/description/share image per page.
  - Legal pages loaded with your text.
  - Public pages read from the database with caching, and changes appear without a redeploy.
- **Acceptance:** each D11 item is editable by a Content Manager and shows on the site within a minute.

## Phase 12: SEO, analytics, performance and accessibility (M)
- **Deliverables:**
  - Structured data: Organization, LocalBusiness with the Faisalabad address, Course, Article and FAQ, plus breadcrumbs. No fabricated ratings.
  - Bilingual sitemap with `hreflang`, and Search Console verification.
  - GA4 behind a consent banner, with conversion events for inquiry, newsletter and enrollment request.
  - Image optimisation, a Core Web Vitals pass, and an accessibility audit (WCAG 2.1 AA target).
- **Owner inputs:** GA4 Measurement ID and Search Console access.

## Phase 13: QA, security review, backups and production launch (M)
- **Deliverables:**
  - Full regression and end-to-end suite; security review of auth, uploads, authorisation and headers.
  - Dependency audit (no forced upgrades).
  - Backup procedure (Hostinger DB backups + scheduled export + media backup) with a **tested restore**.
  - Production env checklist, launch, uptime monitoring on `/api/health`, and a maintenance runbook.
- **Acceptance:** restore tested from backup; all launch features verified on the live domain.

## Phase 14: Later options (not scheduled)
Each will be scoped with cost and dependencies when you prioritise it:
- **Payments:** paid courses and a payment gateway (local or international), coupons and memberships.
- **Teaching:** quizzes and assignments, live classes and webinars, instructor payouts.
- **Messaging:** email campaigns, the WhatsApp Business API.
- **Automation:** automatic Google Drive sharing via the Drive API, CRM integration.
- **Growth:** community, referral and affiliate programs, service booking, digital products, AI learning assistant, more languages.

---

## Dependency summary

| Package | Phase | Status |
| --- | --- | --- |
| better-auth | 3 | Approved (D23) |
| nodemailer | 3 | To approve (SMTP sending; free) |
| pdf-lib or similar | 10 | To approve (certificates; free) |
| Noto Naskh Arabic font files | 1 | Free (SIL Open Font License), self-hosted |
| No i18n library | 1 | Built-in Next.js dictionary approach |
