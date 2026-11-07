# Student Registration & Onboarding Guide

A 30-page, 16:9 PDF for prospective and newly enrolled students:
**`Digitals_Minds_Student_Registration_Guide.pdf`**.

It walks through the real journey, in order: website → program → application → email confirmation →
payment instructions → payment details → verification → enrollment confirmed → set password → log in →
dashboard → onboarding → batch details → schedule and live sessions → documents, notices, notifications →
support → profile, plus "lost your link", FAQ and contact pages.

| Path | What it is |
| --- | --- |
| `Digitals_Minds_Student_Registration_Guide.pdf` | The guide (fonts embedded, links clickable) |
| `source/guide.html` | Editable source: one `<section class="slide">` per page, 1280 × 720 px |
| `source/build.mjs` | Prints `guide.html` to the PDF |
| `source/capture.mjs` | Takes every screenshot from a running copy of the site |
| `source/tools/mail-catcher.py` | Local SMTP server that saves the site's emails as `.eml` files |
| `source/tools/otf2ttf.py` | Converts Inter .otf to .ttf (already done; kept for font updates) |
| `source/brand/` | Unmodified copies of the official logos from `public/brand/` |
| `source/fonts/` | Inter (SIL Open Font License, see `LICENSE-Inter.txt`) |
| `screenshots/raw/` | 30 original screenshots of the real interface (2× resolution; stored as palette PNGs at quality 95, visually identical) |
| `screenshots/annotated/` | The same with numbered markers (used in the PDF) |
| `screenshots/manifest.json` | What each screenshot shows and which elements are marked |

All people, CNIC numbers, phone numbers, payment accounts, transaction IDs and the class link in
the screenshots are **fictional test data**. The payment page uses example accounts and no QR code.
Private links in the emails are masked. Nothing was captured from the live site or its database.

## Regenerating after website changes

Never point the capture at production: it creates an owner account, programs and applications.

1. **A fresh local copy of the site.** Create an empty MySQL/MariaDB database, apply migrations and
   build:
   ```bash
   export DATABASE_URL="mysql://user:pass@localhost:3306/dm_guide"
   npx prisma migrate deploy
   SKIP_DB_MIGRATE=1 npm run build
   ```
2. **The mail catcher** (needs `pip install aiosmtpd` and a self-signed `cert.pem`/`key.pem` in the
   folder you run it from):
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"
   mkdir -p mail && python3 /path/to/source/tools/mail-catcher.py mail &
   ```
   It accepts the login `noreply@test.local` / `mail-pass-123` on port 2525, which `capture.mjs` enters
   in Admin → Integrations → Email.
3. **Start the site** with a setup code and the mail catcher's certificate trusted:
   ```bash
   BETTER_AUTH_SECRET="<32+ random characters>" ADMIN_SETUP_CODE="<16+ characters>" \
   NODE_EXTRA_CA_CERTS=$PWD/cert.pem UPLOAD_DIR=/tmp/dm-guide-uploads npx next start -p 3000
   ```
4. **Capture** (about 3 minutes; needs Playwright with Chromium):
   ```bash
   node docs/student-registration-guide/source/capture.mjs \
     --base http://localhost:3000 --mail /path/to/mail --setup-code "<ADMIN_SETUP_CODE>"
   ```
   Set `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs` if Playwright isn't installed in the project.
   Re-run from step 1 (empty database, empty mail folder) for every capture.
5. **Build the PDF:**
   ```bash
   node docs/student-registration-guide/source/build.mjs
   ```
   The build fails if a screenshot or font is missing. Screenshots are embedded as high-quality JPEG
   copies (via `sharp`, already a project dependency); the PNG originals stay unchanged.
6. **Check every page** before sharing it, for example `pdftoppm -r 110 -png <pdf> pages/p` and open
   the images. Look for clipped text, cropped markers and screenshots that no longer match the text.

### When the website changes

- Wording or a button label changed: update the matching text in `source/guide.html`, then re-capture.
- A form gained or lost a field: update the selectors and markers in `source/capture.mjs` (each
  `shot(...)` call lists its markers as `[selector, number]`), then the numbered list on that page.
- A new student-facing feature: add a `shot(...)` in `capture.mjs` and a slide in `guide.html` (copy
  an existing slide). Page numbers are plain text in each slide's footer; keep them in order.

Last captured: November 2026 (eBay Training example, fee Rs 3,500).
