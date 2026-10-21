import { getCurrentUser } from "@/modules/auth/session";
import { liveClassForViewer, liveClassIcs } from "@/modules/live/service";

export const dynamic = "force-dynamic";

/** "Add to calendar" file for a live class (enrolled students and course staff only). */
export async function GET(_req: Request, { params }: RouteContext<"/api/live/[id]/ics">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const live = user ? await liveClassForViewer(id.slice(0, 64), user) : null;
  if (!live) return new Response("Not found", { status: 404 });
  return new Response(liveClassIcs(live), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-live-class.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
