import { toCsv } from "@/lib/csv";
import { pkDay } from "@/lib/pk-time";
import { getDictionary } from "@/i18n/get-dictionary";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { getBatch } from "@/modules/batches/service";
import { roster } from "@/modules/enrollments/service";

export const dynamic = "force-dynamic";

/** CSV of a batch's students (Super Admin only). No CNIC or CV. */
export async function GET(_req: Request, { params }: RouteContext<"/api/admin/batches/[id]/export">) {
  const id = (await params).id.slice(0, 64);
  const user = await getCurrentUser();
  if (!user || !can(user.role, "students.export")) return new Response("Not found", { status: 404 });
  const [batch, rows] = await Promise.all([getBatch(id, user), roster(id, user)]);
  if (!batch || !rows) return new Response("Not found", { status: 404 });
  const stages = getDictionary("en").apply.stages;
  const csv = toCsv(
    ["Name", "Email", "Phone", "City", "Stage", "Onboarding (required done/total)", "Application", "Enrolled (UTC)", "Account"],
    rows.map((r) => [
      r.user.name,
      r.user.email,
      r.user.phone,
      r.user.city,
      r.stage ? stages[r.stage] : r.status,
      `${r.onboarding.requiredDone}/${r.onboarding.requiredTotal}`,
      r.application?.reference ?? "",
      r.decidedAt ?? r.createdAt,
      r.user.status === "SUSPENDED" ? "Suspended" : "Active",
    ]),
  );
  await audit({ actorId: user.id, action: "export.batch", entityType: "Batch", entityId: id, metadata: { code: batch.code, rows: rows.length } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-${batch.code.toLowerCase()}-${pkDay()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
