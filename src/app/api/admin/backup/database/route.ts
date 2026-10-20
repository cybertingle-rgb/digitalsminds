import { siteConfig } from "@/config/site";
import { pkDay } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { sqlDump } from "@/modules/backup/sql-dump";
import { downloadHeaders, gzipStream } from "@/modules/backup/stream";

export const dynamic = "force-dynamic";

/** Full database backup as .sql.gz (Super Admin only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "backups.download")) return new Response("Not found", { status: 404 });
  await audit({ actorId: user.id, action: "backup.database", entityType: "Backup" });
  return new Response(gzipStream(sqlDump({ createdAt: new Date(), site: siteConfig.url })), {
    headers: downloadHeaders(`digitalsminds-database-${pkDay()}.sql.gz`, "application/gzip"),
  });
}
