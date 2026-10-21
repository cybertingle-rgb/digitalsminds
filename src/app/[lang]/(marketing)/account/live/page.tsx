import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LiveClassCard } from "@/components/learning/LiveClassCard";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { studentLiveClasses } from "@/modules/live/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live classes", robots: noindex };

export default async function StudentLivePage({ params }: PageProps<"/[lang]/account/live">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/live", locale))}`);
  const t = dict.live;
  const { upcoming, past } = await studentLiveClasses(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-charcoal-900">{t.title}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t.intro}</p>
        <p className="mt-1 text-xs text-muted">{t.timezone} {t.joinSoon}</p>
      </div>
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
            {past.map((c) => <li key={c.id} className="p-4"><LiveClassCard c={c} locale={locale} dict={dict} compact /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
