# Backups and restore

The website's data lives in two places:

| What | Where | Backed up by |
| --- | --- | --- |
| Database (accounts, courses, progress, certificates, inquiries, content, settings) | Hostinger MySQL/MariaDB | Admin → Backups → **Database** (.sql.gz) and Hostinger's automatic backups |
| Uploaded files (images, logos, course files) | Upload folder outside the app (`UPLOAD_DIR`, default `~/digitalsminds-uploads`) | Admin → Backups → **Files** (.tar.gz) and Hostinger's file backups |
| Code | GitHub | Git history |
| Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, ...) | Hostinger environment variables | Keep a copy in a password manager |

## Routine (owner)

1. **Every week, and before big changes** (bulk edits, imports, updates): sign in as Super Admin → **Backups** →
   download both files.
2. Store them somewhere private and separate from Hostinger (for example a private Google Drive folder).
   Keep at least the last 4 weekly copies and one from each month.
3. Once a month, check that **hPanel → Files → Backups** shows recent automatic backups of both the files and the
   database, and that the upload folder is inside the backed-up area (it is in your home directory).
4. Keep `BETTER_AUTH_SECRET` in your password manager. Saved email and Google passwords are encrypted with it;
   without the same secret they must be re-entered in Admin → Integrations after a restore.

Backup files contain personal data and scrambled passwords: never share them or upload them anywhere public.

What a database backup contains: every table, including the migration history, so a restored database is
already up to date. Login sessions, password-reset/verification links and rate-limit counters are left out
(their tables are created empty), so everyone signs in again after a restore.

## Restore

Restoring replaces the live data with the backup. Take a fresh backup first if the site still works.

### Database

**With phpMyAdmin (no SSH needed):**
1. hPanel → Databases → phpMyAdmin → open the website's database.
2. Import → choose the `digitalsminds-database-YYYY-MM-DD.sql.gz` file → Import. The file drops and recreates
   each table, so the database does not need to be emptied first.
3. If phpMyAdmin reports the file is too large, ask Hostinger support to import it, or use SSH below.

**With SSH or any MySQL client:**
```bash
gunzip -c digitalsminds-database-YYYY-MM-DD.sql.gz | mysql -h HOST -u USER -p DATABASE
```

### Uploaded files

**With File Manager:** hPanel → File Manager → open the upload folder (shown at the bottom of Admin → Backups)
→ upload `digitalsminds-media-YYYY-MM-DD.tar.gz` → right-click → Extract (into the same folder) → delete the archive.

**With SSH:**
```bash
tar -xzf digitalsminds-media-YYYY-MM-DD.tar.gz -C ~/digitalsminds-uploads
```

### After restoring
1. Redeploy (or restart) the app so caches are cleared.
2. Open `/api/health`: it should return `{"status":"ok","database":"ok"}`.
3. Sign in as Super Admin, open a page with images and a course with files, and check Admin → Integrations.
4. Run Admin → Integrations → File storage → **Run check**.

## Moving to a new server

Same as a restore: create the database, set the same environment variables (same `BETTER_AUTH_SECRET`), deploy
the code, then restore the database and files as above. The build applies any newer migrations automatically.

## Restore drill (tested)

The full cycle was tested on 2026-10-20 with a database filled by the end-to-end suites (accounts, courses, blog,
FAQs with Urdu text, settings, uploaded images):
- backups downloaded from Admin → Backups as a Super Admin (and logged in Activity);
- the media archive was byte-identical to the upload folder after extraction;
- the SQL file was imported into an empty database and every table matched the original (row counts and
  `CHECKSUM TABLE`);
- the live database and upload folder were then deleted and restored: the site served the edited homepage and
  images, the owner signed in with the existing password, encrypted email settings still worked, `prisma migrate
  status` showed nothing pending, and a new backup taken after the restore was identical to the original.

Repeat the drill (on a copy, never on the live database) after major changes to the data model.
