import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { describeAction } from "@/modules/audit/labels";
import { requirePagePermission } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function ActivityPage({ searchParams }: PageProps<"/[lang]/admin/activity">) {
  await requirePagePermission("audit.view", "/admin/activity");
  const sp = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));

  const [entries, total] = await Promise.all([
    db().auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db().auditLog.count(),
  ]);

  // Resolve the people that user-related entries refer to.
  const userIds = [...new Set(entries.filter((e) => e.entityType === "User" && e.entityId).map((e) => e.entityId!))];
  const subjects = new Map(
    (await db().user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]),
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Activity</h1>
        <p className="mt-1 text-muted">A permanent record of sensitive admin actions: who did what, and when (Pakistan time).</p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-line bg-white p-6 text-muted">No activity recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-alt text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start">When</th>
                <th scope="col" className="px-4 py-3 text-start">Who</th>
                <th scope="col" className="px-4 py-3 text-start">What</th>
                <th scope="col" className="px-4 py-3 text-start">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => {
                const subject = e.entityType === "User" && e.entityId ? subjects.get(e.entityId) : undefined;
                const meta = e.metadata && typeof e.metadata === "object" ? Object.entries(e.metadata as Record<string, unknown>) : [];
                return (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dateFmt.format(e.createdAt)}</td>
                    <td className="px-4 py-3">{e.actor ? e.actor.name : <span className="text-muted">Deleted user</span>}</td>
                    <td className="px-4 py-3 font-medium text-charcoal-900">
                      {describeAction(e.action)}
                      {subject && <span className="block font-normal text-muted" dir="ltr">{subject.name} · {subject.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {meta.length === 0 ? "-" : meta.map(([k, v]) => <span key={k} className="block">{k}: {String(v)}</span>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/admin/activity?page=${page - 1}`} className="underline underline-offset-4">Newer</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/admin/activity?page=${page + 1}`} className="underline underline-offset-4">Older</Link>}
        </nav>
      )}
    </div>
  );
}
