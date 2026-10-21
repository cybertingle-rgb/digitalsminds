import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { pkDay } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { parseStudentFilters, studentsForExport } from "@/modules/students/service";

export const dynamic = "force-dynamic";

/** CSV export of students (Super Admin only), honouring the current filters. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "students.export")) return new Response("Not found", { status: 404 });
  const filters = parseStudentFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await studentsForExport(filters);
  const csv = toCsv(
    ["Joined (UTC)", "Name", "Email", "Email verified", "Phone", "City", "Account", "Current programs (batch)", "Completed programs", "Withdrawn from", "Last active (UTC)"],
    rows.map((s) => [
      s.createdAt,
      s.name,
      s.email,
      s.emailVerified ? "Yes" : "No",
      s.phone,
      s.city,
      s.status === "SUSPENDED" ? "Suspended" : "Active",
      s.enrolled.join("; "),
      s.completed.join("; "),
      s.withdrawn.join("; "),
      s.lastActive ?? "",
    ]),
  );
  await audit({ actorId: user.id, action: "export.students", entityType: "User", metadata: { rows: rows.length, filters } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-students-${pkDay()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
