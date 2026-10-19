# Deployment

The app is a standard Next.js Node server plus a MySQL/MariaDB database. Any host
that runs **Node.js ≥ 20.9** works. Before going live, check the target host for:

- [ ] Node.js version ≥ 20.9 (22 LTS recommended)
- [ ] A MySQL 8+ / MariaDB 10.6+ database (your host's own, e.g. Hostinger/cPanel MySQL, or a managed one)
- [ ] A way to set environment variables (dashboard, `.env` outside the web root, or cPanel "Environment variables")
- [ ] HTTPS on the domain (needed for HSTS and secure cookies in Phase 2)

## Every deployment

```bash
npm ci                 # installs deps and generates the Prisma client
npm run db:deploy      # applies pending migrations (never use `migrate dev` in production)
npm run build
npm start              # or the standalone server, see below
```

Set at **build** time: `NEXT_PUBLIC_SITE_URL` (and any `NEXT_PUBLIC_CONTACT_*`).
Set at **runtime**: `DATABASE_URL`, `INQUIRY_WEBHOOK_URL` (optional).

After deploying, check `GET /api/health`. It should return `{"status":"ok","database":"ok"}`.
Point an uptime monitor at it.

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

1. Confirm the plan offers **Node.js ≥ 20.9** in *Setup Node.js App*. Plain PHP-only shared hosting cannot run this app.
2. Build locally or in CI with `NEXT_OUTPUT=standalone npm run build` and copy `public/` and `.next/static/` into `.next/standalone/` as above.
3. Upload the contents of `.next/standalone/` to the app root (outside `public_html`).
4. In *Setup Node.js App*: application startup file `server.js`; add the environment variables there.
5. Database: create a MySQL database + user in hPanel/cPanel, then set
   `DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME`.
   Use `localhost` when the app runs on the same hosting account; from anywhere else, use the
   remote MySQL hostname and allow your IP under *Remote MySQL*.
6. Create the tables: set the build command to `npm run db:deploy && npm run build` so migrations run on the
   host (where `localhost` reaches the database), or run `npm run db:deploy` from your machine with Remote MySQL enabled.

## Moving from the current site

The existing digitalsminds.com could not be inspected from the build environment. Before pointing DNS at
the new app:

- Export any existing data (form submissions, blog posts, subscribers) and keep a full backup of the current site.
- List the current URLs and add redirects for changed paths in `next.config.ts` (`async redirects()`) to keep SEO.
- Copy official logos into `public/brand/` and review all service copy against your official materials.
