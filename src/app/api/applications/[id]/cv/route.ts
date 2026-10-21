import { cvFor } from "@/modules/admissions/service";
import { getCurrentUser } from "@/modules/auth/session";
import { fileResponse } from "@/modules/media/serve";

export const dynamic = "force-dynamic";

/** An applicant's CV: Super Admins only. Same 404 for missing and forbidden. */
export async function GET(_req: Request, { params }: RouteContext<"/api/applications/[id]/cv">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cv = user ? await cvFor(id.slice(0, 64), user) : null;
  if (!cv) return new Response("Not found", { status: 404 });
  return fileResponse(cv, { cacheControl: "private, no-store" });
}
