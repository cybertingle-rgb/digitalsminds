import { toCsv } from "@/lib/csv";
import { pkDay } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { listSubscribers, unsubscribeUrl } from "@/modules/newsletter/service";

export const dynamic = "force-dynamic";

/** Confirmed subscribers as CSV (Super Admin), each with their personal unsubscribe link for use in mailings. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "newsletter.export")) return new Response("Not found", { status: 404 });
  const rows = await listSubscribers({ status: "SUBSCRIBED", take: 50_000 });
  const csv = toCsv(
    ["Email", "Language", "Confirmed (UTC)", "Joined from", "Unsubscribe link"],
    rows.map((s) => [s.email, s.locale === "ur" ? "Urdu" : "English", s.consentAt, s.source, unsubscribeUrl(s.unsubscribeToken, s.locale === "ur" ? "ur" : "en")]),
  );
  await audit({ actorId: user.id, action: "export.newsletter", entityType: "NewsletterSubscriber", metadata: { rows: rows.length } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="digitalsminds-newsletter-${pkDay()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
