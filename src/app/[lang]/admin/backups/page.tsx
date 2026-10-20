import type { Metadata } from "next";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Notice } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { uploadRoot } from "@/lib/storage/local";
import { requirePagePermission } from "@/modules/auth/session";
import { listFiles } from "@/modules/backup/media-archive";

export const metadata: Metadata = { title: "Backups" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const button = "inline-flex items-center justify-center rounded-full bg-charcoal-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-charcoal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500";

async function mediaSummary() {
  const root = uploadRoot();
  const files = await listFiles(root);
  let bytes = 0;
  for (const f of files) bytes += (await stat(path.join(root, f)).catch(() => ({ size: 0 }))).size;
  return { count: files.length, bytes };
}

async function databaseBytes() {
  try {
    const [row] = await db().$queryRawUnsafe<{ bytes: unknown }[]>("SELECT SUM(data_length + index_length) AS bytes FROM information_schema.TABLES WHERE table_schema = DATABASE()");
    return Number(row?.bytes ?? 0);
  } catch {
    return 0;
  }
}

export default async function BackupsPage() {
  await requirePagePermission("backups.download", "/admin/backups");
  const [media, dbBytes, last] = await Promise.all([
    mediaSummary(),
    databaseBytes(),
    db().auditLog.findMany({ where: { action: { in: ["backup.database", "backup.media"] } }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
  ]);
  const lastOf = (action: string) => last.find((l) => l.action === action);
  const lastDb = lastOf("backup.database");
  const lastMedia = lastOf("backup.media");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Backups</h1>
        <p className="mt-1 text-muted">Download a copy of the website&apos;s data and keep it somewhere safe (for example Google Drive). Do this at least once a week and before big changes.</p>
      </div>

      <Notice tone="info">
        Backup files contain personal data and scrambled passwords. Store them privately and never share them. Hostinger also keeps its own automatic backups (hPanel → Files → Backups).
      </Notice>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="db-title" className="glass space-y-3 rounded-2xl p-6">
          <h2 id="db-title" className="text-lg font-semibold text-charcoal-900">Database</h2>
          <p className="text-sm text-muted">
            Accounts, courses, enrollments, progress, certificates, inquiries, website content and settings{dbBytes ? ` (about ${size(dbBytes)} before compression)` : ""}. Login sessions are not included.
          </p>
          <a href="/api/admin/backup/database" download className={button}>Download database backup (.sql.gz)</a>
          <p className="text-xs text-muted">Last downloaded: {lastDb ? `${dateFmt.format(lastDb.createdAt)} by ${lastDb.actor?.name ?? "a removed user"}` : "never"}</p>
        </section>
        <section aria-labelledby="media-title" className="glass space-y-3 rounded-2xl p-6">
          <h2 id="media-title" className="text-lg font-semibold text-charcoal-900">Uploaded files</h2>
          <p className="text-sm text-muted">
            Images, logos and course files from the Media library: {media.count} {media.count === 1 ? "file" : "files"}, {size(media.bytes)}.
          </p>
          <a href="/api/admin/backup/media" download className={button}>Download files backup (.tar.gz)</a>
          <p className="text-xs text-muted">Last downloaded: {lastMedia ? `${dateFmt.format(lastMedia.createdAt)} by ${lastMedia.actor?.name ?? "a removed user"}` : "never"}</p>
        </section>
      </div>

      <section aria-labelledby="restore-title" className="glass space-y-3 rounded-2xl p-6 text-sm text-charcoal-800">
        <h2 id="restore-title" className="text-lg font-semibold text-charcoal-900">Restoring</h2>
        <p>Restoring replaces everything on the live site with the backup. Ask your developer if you are unsure; the full steps are in docs/BACKUP.md.</p>
        <ol className="list-decimal space-y-1 ps-5">
          <li>Database: hPanel → Databases → phpMyAdmin → open the website&apos;s database → Import → choose the .sql.gz file → Import.</li>
          <li>Files: hPanel → File Manager → open the upload folder → upload the .tar.gz file → Extract.</li>
          <li>Keep the same BETTER_AUTH_SECRET: saved email and Google passwords are encrypted with it.</li>
          <li>Everyone signs in again afterwards.</li>
        </ol>
        <p className="text-xs text-muted">Upload folder on this server: <code dir="ltr">{uploadRoot()}</code></p>
      </section>
    </div>
  );
}
