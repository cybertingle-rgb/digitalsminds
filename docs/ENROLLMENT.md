# Enrollment platform: how it works

Digitals Minds runs paid courses and training programs in **batches**. The website does not teach
courses online (no lessons, videos or progress tracking). It handles the student journey from discovering a
program to paying, enrolling, joining a batch, onboarding and ongoing administration.

## The student journey

| # | Stage | Who | What happens |
| --- | --- | --- | --- |
| 1 | **Application received** | Visitor | Chooses an open batch on the program page and applies: name, email, phone/WhatsApp, city, CNIC, CV (PDF/DOCX ≤ 5 MB), accepts the Terms and Refund Policy. No account is created. |
| 2 | **Payment pending** | Visitor | Opens the private link we email them (the status page confirms the email address on its first visit; the link itself only stores the token and redirects, so it never waits on the database). The status page shows the reference (e.g. `DM-7KQ4-XZ2M`), fee and payment accounts. |
| 3 | **Payment submitted** | Visitor | Sends method, transaction ID, date and receipt (JPG/PNG/WebP/PDF ≤ 8 MB). Super Admins get an email. A receipt alone unlocks nothing. |
| 4 | **Payment verified** | Super Admin | Checks the money arrived in the statement, enters the amount received (must be the full fee) and verifies. |
| 5 | **Enrollment confirmed** | System | In the same database transaction: the seat is reserved (batch row locked, so no overbooking), the student account is created (or an old suspended account reactivated) and the enrollment is placed in the batch. The student is emailed a "Set my password" link (valid 7 days). |
| 6 | **Onboarding** | Student | Starts when they first open the portal; they work through the checklist (some steps are confirmed by staff). |
| 7 | **Active student** | System/staff | Automatic once every required step is done (immediately if there are none); staff can also set it. |
| 8 | **Completed** | Staff | Marked by staff; certificates (where enabled) are then issued from Admin → Certificates. |

Side exits: **Rejected / Cancelled** (an open application, Super Admin, with an optional note), **Withdrawn** (a student,
Super Admin, reason required; frees the seat; can be reinstated if a seat is free). If a payment is rejected the
application goes back to *Payment pending* and the applicant is emailed the reason with a fresh link.

## Rules enforced by the server

- Self sign-up is closed (email and Google). Student accounts come only from step 5; staff accounts only from Admin → Team invitations; the owner account only from `/setup`.
- One open application per email per batch; an email already enrolled in the program can't apply again; team emails can't apply.
- A transaction ID can't be used twice for the same method (case, spaces and dashes ignored), across all applications; a verified one is also locked by a unique database key.
- Verifying is atomic and only works once: two clicks at the same moment create one account and one enrollment.
- Seats are counted from verified students (confirmed, onboarding, active, completed). A full batch stops taking applications and can't be verified into; move the application (Super Admin) or add seats first.
- Fees are stored per application at the moment of applying (a later fee change doesn't affect it). Fees are whole PKR, paid in full.
- Batch details (joining instructions, meeting links, schedule, notices, documents) are shown only to that batch's current students.
- CNIC numbers and CVs are visible only to Super Admins and are never in CSV exports.

## Who can do what

| | Super Admin | Content Manager | Batch Coordinator | Student |
| --- | --- | --- | --- | --- |
| Programs (create, edit, publish) | ✓ | ✓ | | |
| Enrollment fee, payment account details | ✓ | | | |
| Batches (create, edit, seats, coordinator) | ✓ | ✓ | own batches: view | |
| Applications pipeline | ✓ | ✓ (no CNIC/CV) | | own, via private link |
| Verify / reject payments | ✓ | | | |
| Move, reject or cancel applications; transfer or withdraw students | ✓ | | | |
| Stage changes (onboarding → active → completed) | ✓ | ✓ | own batches | |
| Schedule (classes, holidays, events) and batch notices | ✓ | ✓ | own batches | view own |
| Onboarding checklists and documents | ✓ | ✓ | confirm staff steps (own batches) | tick own steps, download own |
| Student records | ✓ (edit, suspend, delete) | view | | own profile |
| Categories and services | ✓ | ✓ | | |
| Currency settings, rate refresh, converting old prices | ✓ | | | |
| Attendance (where switched on) | ✓ | ✓ | own batches | view own |
| CSV exports (students, applications, batch roster) | ✓ | | | |

"Batch Coordinator" is the former Instructor role. Assign a coordinator on the batch page.

## Admin quick guide

1. **Payments → Payment details**: enter the bank / JazzCash / EasyPaisa accounts applicants pay to (shown only on their private application page). Bank transfer shows the built-in Meezan Bank QR code by default (enough on its own to offer bank transfer); choose another public Media image or "No QR code" there.
2. **Programs**: create the program, write the description, objectives, eligibility, format and duration; set the **Enrollment fee** (Super Admin); publish.
3. **Batches → New batch**: dates, class times, seats, optional deadline, meeting link, joining instructions, coordinator. Set the status to **Open** to take applications.
4. **Onboarding** and **Documents**: add checklist steps and files for everyone, a program or a batch.
5. **Applications**: work the "Payment to verify" tab. Open an application, compare the receipt with the statement, then *Verify* (or *Reject* with a reason).
6. **Batches → (batch)**: roster with stages, staff-confirmed steps, transfers, schedule and notice links, CSV export.
7. **Schedule**: classes (Zoom/Meet link, defaults to the batch link), holidays (no class, emailed) and events. Reminders go out 1 day and 1 hour before each class.
8. **Announcements**: notices to all current students, a program or a batch (optionally emailed).
9. **Students**: a one-off panel lists old free-sign-up accounts (no payment, application or batch) with a button to suspend them after you've checked the list.

## Catalogue: categories and services

- **Admin → Programs → Categories**: groups for programs and services (six to start: E-commerce Marketplace Training, International Brand Launching, LLC Registration & Marketplace Readiness, Suspended Account Reinstatement, Digital Marketing & Business Skills, AI & Automation). Categories with published programs become filters on `/courses`; a category's **notice** is shown on its program and service pages (e.g. marketplace eligibility depends on each platform's policies; approval is never guaranteed).
- **Admin → Programs → (program)**: choose the program's category. Fees, batches and seats are set as before.
- **Admin → Services**: the professional services visitors ask about without an account (brand launch, LLC & marketplace readiness, account reinstatement, AI & automation, plus the original five). Each has a summary, description, what's included, who it suits, a notice, a category, an order and draft/published/archived. Published services appear on `/services`, `/services/<address>`, the home page, the footer and the contact form; inquiries land in **Inquiries** with the service name.
- The contact form tells visitors not to send passwords or codes; the reinstatement service says the same and that reinstatement is the marketplace's decision.

## International prices (display only)

Fees are set, owed and paid in **PKR**. Visitors abroad also see an estimate in their own currency:

| | |
| --- | --- |
| Which currency | The visitor's own choice ("Show prices in", remembered in their browser), else their country (from a CDN header such as Cloudflare's, if one is in front of the site, else the browser's time zone; never GPS), else PKR. |
| Rates | ExchangeRate-API open access (`https://open.er-api.com/v6/latest/PKR`, updated daily, "Rates by ExchangeRate-API" shown), or ExchangeRate-API with your key, or rates you type in. Fetched inside the server every 12 hours (10-second timeout); the last good rates are kept if a fetch fails. |
| Never stale | A rate older than 72 hours (configurable) is not shown; prices fall back to PKR. The provider's own update time is stored and shown. |
| Rounding | Each currency's own minor unit (JPY 0, KWD 3, most 2), half up; amounts from 1,000 are shown without cents. |
| Applications | When someone applies, the server records the estimate it would show them (currency, amount, rate, rate date, provider) next to the PKR fee. The fee owed never changes. |
| Paying from abroad | The payment page says the full PKR amount must arrive. Payers abroad can note what they sent and in which currency; the Super Admin verifies the PKR received. |
| Old prices | Any fee stored in another currency (or none) was flagged by the migration, not guessed. **Admin → Payments → Currency & rates → Prices to review**: convert it with the current rate (original amount, rate, date and source are kept) or set the PKR fee by hand. |

**Admin → Payments → Currency & rates** (Super Admin): status (last success, last attempt, error), current rates, "Update rates now", currencies offered, update interval, maximum age, provider and API key (stored encrypted), manual rates. Failures also appear on the admin overview.

## Time zones and attendance

- Each batch has a **time zone** (default Pakistan). Class times are entered in it, shown with its abbreviation (PKT, GMT, …) in the portal, emails and the program page, and students whose browser is elsewhere also see their own time.
- **Attendance** is off unless switched on for a batch (batch settings). Then **Batches → (batch) → Attendance** lists the classes that have started (not holidays or cancelled ones); the coordinator or a manager marks each student present, late, absent or excused, with an optional note. Students see their mark on each past class and "Attended X of Y classes" (excused classes don't count). Switching it off keeps earlier records.

## Configuration

Nothing new to configure in Hostinger (exchange rates need outgoing HTTPS to `open.er-api.com`, which Hostinger allows; set `CURRENCY_REFRESH=off` to stop the scheduled updates). Requirements:

- **Email** (Admin → Integrations → Email) must work: applicants receive their private link, payment updates and the set-password link by email.
- **Payment details** must be entered, or applicants see "contact us" instead of the accounts.
- Uploaded CVs, receipts and student documents are stored privately under the upload folder (`UPLOAD_DIR`, default `~/digitalsminds-uploads`) in `applications/cv/`, `receipts/` and `documents/`. They are included in Admin → Backups → files.
- Legal pages: the built-in Privacy Policy, Terms and Refund Policy (effective 2026-10-22) describe this model and are published. Edited copies saved in Admin → Website → Legal pages before that date are replaced by the new text (the admin page says so); edits saved after it are shown as saved.

## Data

Additive migration `20261022000000_phase15_enrollment_platform`: tables `Batch`, `EnrollmentApplication`,
`EnrollmentEvent`, `OnboardingItem`, `OnboardingProgress`, `StudentDocument`; new nullable columns on
`Enrollment` (batch, stage), `Payment` (application, amount received, verified key; `userId` now nullable),
`LiveClass` (batch, kind; meeting link optional), `Announcement` (batch), `Course` (format, duration text).
No data was changed or deleted.

Additive migration `20261024000000_phase21_catalog_pricing_attendance`: tables `ProgramCategory` (six starting rows),
`Service` (filled from the built-in text on first use), `CurrencyRate`, `Attendance`; new columns on `Course` (category,
original price and conversion record, review flag), `Batch` (time zone, attendance switch), `EnrollmentApplication`
(price snapshot) and `Payment` (amount/currency sent from abroad). Data steps only add: existing non-PKR prices are copied
to the "original" columns and flagged for review, and programs with "eBay" in their name or address are put in the
marketplace category. The old lesson, module, resource and progress tables are kept untouched
(unused); removing them is a separate, optional step that needs the owner's approval and a backup first.
