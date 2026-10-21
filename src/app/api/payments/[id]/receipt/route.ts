import { getCurrentUser } from "@/modules/auth/session";
import { fileResponse } from "@/modules/media/serve";
import { receiptFor } from "@/modules/payments/service";

export const dynamic = "force-dynamic";

/** A payment receipt: for payment staff and the student who sent it. Same 404 for missing and forbidden. */
export async function GET(_req: Request, { params }: RouteContext<"/api/payments/[id]/receipt">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const receipt = user ? await receiptFor(id.slice(0, 64), user) : null;
  if (!receipt) return new Response("Not found", { status: 404 });
  return fileResponse(receipt, { cacheControl: "private, no-store" });
}
