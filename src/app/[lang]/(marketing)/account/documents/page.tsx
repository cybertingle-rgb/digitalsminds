import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalHeading } from "@/components/portal/PortalParts";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { myDocuments } from "@/modules/portal/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents", robots: noindex };

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function DocumentsPage({ params }: PageProps<"/[lang]/account/documents">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/documents", locale))}`);
  const p = dict.portal;
  const docs = await myDocuments(user.id);
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-8">
      <PortalHeading title={p.navDocuments} intro={p.documentsIntro} />
      {docs.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-muted">{p.documentsEmpty}</p>
      ) : (
        <ul className="glass divide-y divide-charcoal-200/50 rounded-3xl">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-charcoal-900" dir="auto">{d.title}</p>
                {d.description && <p className="mt-1 text-sm text-charcoal-800" dir="auto">{d.description}</p>}
                <p className="mt-1 text-xs text-muted">{d.batch?.name ?? d.course?.title ?? p.forEveryone} · {fmt.format(d.createdAt)} · {size(d.sizeBytes)}</p>
              </div>
              <a href={`/api/documents/${d.id}`} className="rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal-800">{p.download}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
