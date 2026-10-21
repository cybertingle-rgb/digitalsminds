import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalHeading } from "@/components/portal/PortalParts";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { myNotices } from "@/modules/portal/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notices", robots: noindex };

export default async function NoticesPage({ params }: PageProps<"/[lang]/account/notices">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/notices", locale))}`);
  const p = dict.portal;
  const notices = await myNotices(user.id);
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-8">
      <PortalHeading title={p.navNotices} intro={p.noticesIntro} />
      {notices.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-muted">{p.noticesEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {notices.map((a) => (
            <li key={a.id} className="glass rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-700" dir="auto">
                {a.batch?.name ?? a.course?.title ?? p.forEveryone}
                {a.publishedAt && <span className="ms-2 font-normal normal-case tracking-normal text-muted">{fmt.format(a.publishedAt)}</span>}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-charcoal-900" dir="auto">{a.title}</h2>
              <RichText text={a.body} className="mt-2 text-sm text-charcoal-800" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
