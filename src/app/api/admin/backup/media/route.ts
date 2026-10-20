import { pkDay } from "@/lib/pk-time";
import { uploadRoot } from "@/lib/storage/local";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { tarArchive } from "@/modules/backup/media-archive";
import { downloadHeaders, gzipStream } from "@/modules/backup/stream";

export const dynamic = "force-dynamic";

/** All uploaded files as .tar.gz (Super Admin only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "backups.download")) return new Response("Not found", { status: 404 });
  await audit({ actorId: user.id, action: "backup.media", entityType: "Backup" });
  return new Response(gzipStream(tarArchive(uploadRoot())), {
    headers: downloadHeaders(`digitalsminds-media-${pkDay()}.tar.gz`, "application/gzip"),
  });
}
