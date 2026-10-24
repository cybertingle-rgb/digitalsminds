import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LiveClassCard } from "@/components/learning/LiveClassCard";
import { PortalHeading } from "@/components/portal/PortalParts";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { studentAttendance } from "@/modules/attendance/service";
import { studentLiveClasses } from "@/modules/live/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schedule", robots: noindex };

export default async function SchedulePage({ params }: PageProps<"/[lang]/account/schedule">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/schedule", locale))}`);
  const t = dict.live;
  const [{ upcoming, past }, attendance] = await Promise.all([studentLiveClasses(user.id), studentAttendance(user.id)]);

  return (
    <div className="space-y-8">
      <PortalHeading title={t.title} intro={t.intro}>
        <p className="text-xs text-muted">{t.timezone} {t.joinSoon}</p>
      </PortalHeading>
      <section aria-labelledby="upcoming-live">
        <h2 id="upcoming-live" className="text-xl font-bold text-charcoal-900">{t.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 glass-subtle rounded-2xl p-6 text-muted">{t.empty}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((c) => <li key={c.id} className="glass rounded-2xl p-4 sm:p-5"><LiveClassCard c={c} locale={locale} dict={dict} /></li>)}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past-live">
          <h2 id="past-live" className="text-xl font-bold text-charcoal-900">{t.past}</h2>
          <ul className="mt-4 glass divide-y divide-charcoal-200/50 rounded-2xl">
            {past.map((c) => <li key={c.id} className="p-4"><LiveClassCard c={c} locale={locale} dict={dict} compact attendance={attendance.marks.get(c.id) ?? null} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
