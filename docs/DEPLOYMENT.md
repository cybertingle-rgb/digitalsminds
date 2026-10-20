# Deployment

The app is a standard Next.js Node server plus a MySQL/MariaDB database. Any host
that runs **Node.js 20.19+, 22.12+ or 24+** works (22 recommended). Before going live, check the target host for:

- [ ] Node.js 20.19+ / 22.12+ / 24+ (22 LTS recommended)
- [ ] A MySQL 8+ / MariaDB 10.6+ database (your host's own, e.g. Hostinger/cPanel MySQL, or a managed one)
- [ ] A way to set environment variables (dashboard, `.env` outside the web root, or cPanel "Environment variables")
- [ ] HTTPS on the domain (needed for HSTS and secure cookies in Phase 2)

## Every deployment

```bash
npm ci                 # installs deps and generates the Prisma client
npm run build          # prebuild applies pending migrations, then `next build --webpack`
npm start              # or the standalone server, see below
```

If the build log shows `[migrate] WARNING: database not reachable`, run `npm run db:deploy` from a
machine that can reach the database (never use `migrate dev` in production).

Set at **build** time: `NEXT_PUBLIC_SITE_URL` (and any `NEXT_PUBLIC_CONTACT_*`).
Set at **runtime**: `DATABASE_URL`, `INQUIRY_WEBHOOK_URL` (optional).

The build uses 2 worker processes (`experimental.cpus` in `next.config.ts`). Shared hosting
reports many CPUs but limits how many threads an account may start, and the default (one worker
per CPU) crashed the Hostinger build with `OS can't spawn worker thread (os error 11)`. Raise it
with the `NEXT_BUILD_CPUS` environment variable only on a host with spare capacity.

Some dependencies (e.g. `kysely`, used by Better Auth) now ask for Node.js 22+, so choose
**Node.js 22** in the host's settings (Hostinger: Deployments → Build and output settings).

After deploying, check `GET /api/health`. It should return `{"status":"ok","database":"ok"}`.
Point an uptime monitor at it.

## First-time accounts & admin setup (after Phase 3 deploys)

1. In Hostinger → Environment variables, add:
   - `BETTER_AUTH_SECRET`: 32+ random characters (a password manager can generate one). **Keep it forever**; changing it logs everyone out and requires re-entering the saved email password and Google secret.
   - `ADMIN_SETUP_CODE`: 16+ random characters, used once.
2. Redeploy, then open `https://digitalsminds.com/setup`: enter your name, a strong password and the setup code. This creates the Super Admin `info@digitalsminds.com`.
3. Remove `ADMIN_SETUP_CODE` from Hostinger and redeploy (the page is already disabled, this is extra hygiene).
4. Log in at `/login` → **Admin → Integrations → Email**: create `noreply@digitalsminds.com` in hPanel → Emails, then enter
   host `smtp.hostinger.com`, port `465`, SSL on, the mailbox and its password. Click **Save & check connection**, then **Send test email**.
5. **Admin → Integrations → Google** (optional): follow the on-page steps to create an OAuth client in Google Cloud, paste the Client ID and secret,
   **Connect & test**, then switch on "Show Continue with Google".

6. **File storage (before uploading anything):** Admin → Integrations → File storage → **Run check**, then redeploy in Hostinger,
   then **Run check** again. When it says "Confirmed", uploads are switched on. If it never confirms, files in that folder are
   being wiped on deploy: set `UPLOAD_DIR` to another folder outside the app (e.g. `/home/<user>/domains/digitalsminds.com/uploads`)
   and repeat.
7. **Backups:** make sure Hostinger's file backups include the upload folder (download a backup once and check), and keep database backups on.

Without `BETTER_AUTH_SECRET` (or with one shorter than 32 characters) the public site, contact form and health check keep working; login, registration and `/setup` show a "not set up yet" notice instead.

## Option A: Vercel

1. Import the GitHub repo in Vercel (framework is auto-detected).
2. Add the environment variables for Production (and Preview if wanted).
3. Build command: `npm run db:deploy && npm run build` (or run migrations from CI).
4. Use a managed MySQL that allows connections from Vercel (e.g. PlanetScale, Aiven, or a host with Remote MySQL enabled), and keep the connection limit low since serverless opens many connections (`?connectionLimit=5`).
5. The in-memory rate limiter is per-instance on serverless; see ARCHITECTURE.md > Security.

## Option B: VPS / Docker / any Node host (standalone)

```bash
NEXT_OUTPUT=standalone npm run build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
# deploy .next/standalone/ to the server, then:
PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=... node server.js
```

Run it under a process manager (systemd or `pm2 start server.js --name digitalsminds`) behind
Nginx/Caddy with HTTPS. Make sure the proxy forwards `Host`, `X-Forwarded-For` and
`X-Forwarded-Proto` (used for origin checks and rate limiting).

## Option C: cPanel / Hostinger with "Setup Node.js App"

1. Confirm the plan offers **Node.js 20.19+ (22 recommended)** in *Setup Node.js App*. Plain PHP-only shared hosting cannot run this app.
2. Build locally or in CI with `NEXT_OUTPUT=standalone npm run build` and copy `public/` and `.next/static/` into `.next/standalone/` as above.
3. Upload the contents of `.next/standalone/` to the app root (outside `public_html`).
4. In *Setup Node.js App*: application startup file `server.js`; add the environment variables there.
5. Database: create a MySQL database + user in hPanel/cPanel, then set
   `DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME`.
   Use `localhost` when the app runs on the same hosting account; from anywhere else, use the
   remote MySQL hostname and allow your IP under *Remote MySQL*.
6. Keep the default build command `npm run build`: it applies migrations first. If the build log says the
   database is not reachable, enable *Remote MySQL* for your IP and run `npm run db:deploy` from your machine
   using the remote MySQL hostname in `DATABASE_URL`.

## Moving from the current site

The existing digitalsminds.com could not be inspected from the build environment. Before pointing DNS at
the new app:

- Export any existing data (form submissions, blog posts, subscribers) and keep a full backup of the current site.
- List the current URLs and add redirects for changed paths in `next.config.ts` (`async redirects()`) to keep SEO.
- Copy official logos into `public/brand/` and review all service copy against your official materials.
