import { db } from "@/lib/db";
import { manageableCoursesWhere } from "@/modules/auth/scoping";
import { getCurrentUser } from "@/modules/auth/session";
import { canUseMediaLibrary, mediaScope } from "@/modules/media/service";
import { fileResponse } from "@/modules/media/serve";

/**
 * Private Media library files: staff who can manage the file or a program
 * that uses it. (Students get their files through Documents instead.)
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  // Same response for "doesn't exist" and "not allowed", so file ids can't be probed.
  const notFound = () => new Response("Not found", { status: 404 });
  if (!user) return notFound();
  if (canUseMediaLibrary(user)) {
    const asset = await db().mediaAsset.findFirst({
      where: { id, OR: [mediaScope(user), { courseResources: { some: { course: manageableCoursesWhere(user) } } }] },
    });
    if (asset) return fileResponse(asset, { cacheControl: "private, no-store" });
  }
  return notFound();
}
