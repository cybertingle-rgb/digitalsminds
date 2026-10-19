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
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`), versioned migrations |
| Validation | Zod 4, one schema shared by client and server |
| Tests | Vitest (unit + route handler tests) |

## Quick start

Requirements: Node.js ≥ 20.9 (22 recommended, see `.nvmrc`) and PostgreSQL 14+.

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
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` · `npm run typecheck` · `npm test` | Quality checks |
| `npm run db:migrate -- --name <change>` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (production) |

## Environment variables

See `.env.example`. **Never commit `.env`**; it is git-ignored.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes (runtime) | PostgreSQL connection string. Not needed for `next build`. |
| `NEXT_PUBLIC_SITE_URL` | Yes in production | Canonical URL, e.g. `https://digitalsminds.com`. Used for SEO, sitemap and origin checks. Set at **build** time. |
| `NEXT_PUBLIC_CONTACT_EMAIL` / `_PHONE` / `NEXT_PUBLIC_WHATSAPP_NUMBER` | No | Shown on the site only when set. Set at build time. |
| `INQUIRY_WEBHOOK_URL` | No | Receives `{type:"inquiry.created", data}` JSON for each lead (Zapier/Make/Slack/CRM). |

## Content & branding

- **Logo:** add official files to `public/brand/` and set `logo` in `src/config/site.ts` (see `public/brand/README.md`). Until then the brand name renders as text.
- **Colours:** `@theme` block in `src/app/globals.css`.
- **Navigation, tagline, contact, social links:** `src/config/site.ts`.
- **Services:** `src/content/services.ts` (drives services pages, homepage grid, footer and the form's service list).
- **Blog posts:** `src/content/blog.ts`.

No testimonials, client logos or statistics are included. Add them only from verified sources.

## Leads

Inquiries are stored in the `Inquiry` table (status `NEW` → `CONTACTED` → `QUALIFIED` → `CLOSED`/`SPAM`).
Until the Phase 2 admin dashboard exists, view them with `npx prisma studio` or your database console,
or forward them in real time via `INQUIRY_WEBHOOK_URL`.

## Further docs

- [Architecture](docs/ARCHITECTURE.md): structure, request flow, security model
- [Deployment](docs/DEPLOYMENT.md): Vercel, Node/VPS, cPanel Node.js hosting
- [Student Portal plan (Phase 2)](docs/STUDENT_PORTAL.md)
