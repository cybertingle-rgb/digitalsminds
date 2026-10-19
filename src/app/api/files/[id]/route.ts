import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/session";
import { canUseMediaLibrary, mediaScope } from "@/modules/media/service";
import { fileResponse } from "@/modules/media/serve";

/**
 * Private files (course resources). Today: staff who can manage the file.
 * Phase 8 adds students with an approved enrollment in the course using it.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  // Same response for "doesn't exist" and "not allowed", so file ids can't be probed.
  if (!user || !canUseMediaLibrary(user)) return new Response("Not found", { status: 404 });
  const asset = await db().mediaAsset.findFirst({ where: { id, ...mediaScope(user) } });
  if (!asset) return new Response("Not found", { status: 404 });
  return fileResponse(asset, { cacheControl: "private, no-store" });
}
