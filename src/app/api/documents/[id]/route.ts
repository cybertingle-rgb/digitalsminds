import { db } from "@/lib/db";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { fileResponse } from "@/modules/media/serve";
import { studentCanOpenDocument } from "@/modules/portal/service";

export const dynamic = "force-dynamic";

/** A student document: for the students it's shared with, and onboarding staff. Same 404 for missing and forbidden. */
export async function GET(_req: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const id = (await params).id.slice(0, 64);
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const doc = await db().studentDocument.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const allowed = can(user.role, "onboarding.manage") || (doc.published && (await studentCanOpenDocument(user.id, id)));
  if (!allowed) return new Response("Not found", { status: 404 });
  return fileResponse({ storageKey: doc.storageKey, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, originalName: doc.fileName }, { cacheControl: "private, no-store" });
}
