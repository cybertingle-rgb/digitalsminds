import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { pkDay } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { inquiriesForExport, parseFilters } from "@/modules/inquiries/admin";
import { serviceLabel, statusLabels } from "@/modules/inquiries/labels";

export const dynamic = "force-dynamic";

/** CSV export of leads (Super Admin only), honouring the current filters. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "inquiries.export")) return new Response("Not found", { status: 404 });
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await inquiriesForExport(filters, user);
  const csv = toCsv(
    ["Received (UTC)", "Name", "Email", "Phone", "Company", "Service", "Status", "Assigned to", "Follow-up (PKT)", "Message", "Source page", "Language", "UTM source", "UTM medium", "UTM campaign"],
    rows.map((r) => [
      r.createdAt,
      r.name,
      r.email,
      r.phone,
      r.company,
      serviceLabel(r.service),
      statusLabels[r.status],
      r.assignedTo?.name,
      r.followUpAt ? pkDay(r.followUpAt) : "",
      r.message,
      r.source,
      r.locale,
      r.utmSource,
      r.utmMedium,
      r.utmCampaign,
    ]),
  );
  await audit({ actorId: user.id, action: "export.inquiries", entityType: "Inquiry", metadata: { rows: rows.length, filters } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-inquiries-${pkDay()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
