import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { pkDay } from "@/lib/pk-time";
import { getDictionary } from "@/i18n/get-dictionary";
import { audit } from "@/modules/audit/log";
import { listApplications, parseApplicationFilter } from "@/modules/admissions/service";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { formatPkr } from "@/modules/payments/format";

export const dynamic = "force-dynamic";

/** CSV of applications (Super Admin only), honouring the current filters. No CNIC or CV. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "students.export")) return new Response("Not found", { status: 404 });
  const filter = parseApplicationFilter(Object.fromEntries(request.nextUrl.searchParams));
  const { items } = await listApplications(filter, user);
  const stages = getDictionary("en").apply.stages;
  const csv = toCsv(
    ["Applied (UTC)", "Reference", "Name", "Email", "Phone", "City", "Program", "Batch", "Fee", "Stage"],
    items.map((a) => [a.createdAt, a.reference, a.name, a.email, a.phone, a.city, a.course.title, `${a.batch.name} (${a.batch.code})`, formatPkr(a.feeAmount), stages[a.stage]]),
  );
  await audit({ actorId: user.id, action: "export.applications", entityType: "Application", metadata: { rows: items.length, tab: filter.tab } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-applications-${pkDay()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
