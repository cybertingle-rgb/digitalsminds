# Launch checklist and maintenance runbook

## 1. Production settings (Hostinger → Websites → digitalsminds.com)

**Deployments → Build and output settings**
- [ ] Node.js **22**
- [ ] Branch: the release branch; auto-deploy on push if wanted

**Environment variables** (never commit them; keep a copy in a password manager)

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://USER:PASSWORD@localhost:3306/DATABASE` | Hostinger database |
| `NEXT_PUBLIC_SITE_URL` | `https://digitalsminds.com` | Exactly this (https, no trailing slash); used for links, sitemap, sign-in |
| `BETTER_AUTH_SECRET` | 32+ random characters | Never change after launch (signs everyone out, breaks saved email/Google passwords) |
| `UPLOAD_DIR` | optional | Default `~/digitalsminds-uploads` (survives redeploys) |
| `TRUSTED_PROXY_HOPS` | optional, default 1 | Only change if Hostinger support says requests pass through more than one proxy |
| `ADMIN_SETUP_CODE` | **not set** | Only needed for the one-time `/setup`; already removed |
| `NEXT_BUILD_CPUS` | optional | Build workers (default 2) |

## 2. Before going live

- [ ] Deploy succeeds; `https://digitalsminds.com/api/health` returns `{"status":"ok","database":"ok"}`
- [ ] `http://` redirects to `https://`, and `www.` redirects to the main domain (Hostinger → Domains / SSL)
- [ ] Admin → Integrations: Email saved and **Send test email** arrives (check spam); Google sign-in (optional)
- [ ] Admin → Integrations → File storage → **Run check**, redeploy, **Run check** again: "survives redeploys"
- [ ] Owner password changed from the temporary one (Forgot password)
- [ ] Admin → Team: each staff member invited with the right role; no shared accounts
- [ ] Admin → Website: contact email, social links, homepage text, FAQs, legal pages reviewed
- [ ] Admin → Website → Analytics: GA4 Measurement ID and Search Console tag; verify in Search Console and submit `sitemap.xml`
- [ ] At least one course published and tested end to end with a real student account (request access → approve → watch a lesson → complete → certificate)
- [ ] Contact form tested from a phone: inquiry arrives in Admin → Inquiries and as an email alert
- [ ] Newsletter sign-up tested (confirmation email → confirm → appears in Admin → Newsletter)
- [ ] First backup downloaded from Admin → Backups (see BACKUP.md)
- [ ] Uptime monitor set up (below)

## 3. Uptime monitoring

Create a free monitor (for example UptimeRobot or Better Stack):
- URL: `https://digitalsminds.com/api/health`, every 5 minutes
- Alert when the status code is not 200 (the endpoint returns 503 when the database is unreachable)
- Alerts to info@digitalsminds.com (and a second person if possible)

## 4. Maintenance runbook

**Weekly**
- Download both backups (Admin → Backups) and store them privately.
- Look at Admin → Overview: waiting access requests, open support requests, new inquiries and follow-ups.

**Monthly**
- Check Hostinger automatic backups exist (hPanel → Files → Backups).
- Review Admin → Team (remove people who left) and Admin → Activity for anything unexpected.
- Developer: `npm outdated` and `npm audit --omit=dev`; apply patch updates on a branch, run the tests, deploy.
  Never run `npm audit fix --force`.

**Deploying a change**
1. Push to the branch; Hostinger builds it (the build applies database migrations first).
2. If the build fails, the previous version keeps running. Read the build log; fix and push again.
3. After deploying, check `/api/health` and the pages the change touched.

**Rolling back**
- Code: Hostinger → Deployments → redeploy the previous successful deployment (or revert the commit and push).
- Data: migrations only ever add columns or tables, so older code keeps working with a newer database. If data was
  damaged, restore the latest backup (BACKUP.md).

**When something breaks**

| Symptom | Check |
| --- | --- |
| `/api/health` shows `database: "unreachable"` | Database running? `DATABASE_URL` correct? Hostinger status page |
| Emails stop | Admin → Integrations → Email → Send test email; Hostinger mailbox password changed? Daily sending limit reached? |
| Uploads fail | Admin → Integrations → File storage → Run check; disk space in hPanel |
| Everyone signed out / Google and email passwords stop working | `BETTER_AUTH_SECRET` was changed: put the old value back |
| Build fails with "OS can't spawn worker thread" | Keep `NEXT_BUILD_CPUS` at 2 (or 1) |
| "Something went wrong" or "The website was just updated" right after a deploy | A page opened before the deploy runs the old version; it reloads itself (or press Reload page / Ctrl+F5) |
| Live class reminders not arriving | They are sent by the running website every 5 minutes: check Email in Admin → Integrations and that the app is running (Hostinger Runtime logs show "[live]" lines on errors) |
| Pages show old content | Saved changes appear within a minute; redeploy clears all caches |

**Security incident (suspected break-in or leaked password)**
1. Admin → Team / Students: suspend the affected accounts (signs them out everywhere).
2. Change the Hostinger, database and email passwords; update `DATABASE_URL` and Admin → Integrations.
3. If `BETTER_AUTH_SECRET` may have leaked: set a new one (everyone is signed out), then re-enter the email and
   Google passwords in Admin → Integrations.
4. Review Admin → Activity, then restore from a backup if data was changed.
