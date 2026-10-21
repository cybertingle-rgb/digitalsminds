import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewTicketForm } from "@/components/learning/SupportForms";
import { localeMeta, localizePath } from "@/i18n/config";
import { format } from "@/i18n/merge";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { studentTickets, ticketCourses } from "@/modules/support/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support", robots: noindex };

const tone = { OPEN: "bg-sun-100 text-charcoal-900", AWAITING_STUDENT: "bg-sun-400 text-charcoal-900", RESOLVED: "bg-green-100 text-green-900", CLOSED: "bg-charcoal-100 text-charcoal-700" } as const;

export default async function SupportPage({ params }: PageProps<"/[lang]/account/support">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account/support", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const t = dict.support;
  const [tickets, courses] = await Promise.all([studentTickets(user.id), ticketCourses(user.id)]);
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  const title = (c: { title: string; titleUr: string | null }) => (locale === "ur" ? c.titleUr || c.title : c.title);

  return (
    <>
      <div className="max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold text-charcoal-900">{t.title}</h1>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section aria-labelledby="new-ticket" className="glass min-w-0 rounded-3xl p-6 lg:col-span-2">
            <h2 id="new-ticket" className="text-lg font-bold text-charcoal-900">{t.newTicket}</h2>
            <p className="mb-4 mt-1 text-sm text-charcoal-700">{t.intro}</p>
            <NewTicketForm
              lang={locale}
              courses={courses.map((c) => ({ id: c.id, title: title(c) }))}
              labels={{ subject: t.subject, course: t.course, noCourse: t.noCourse, message: t.message, send: t.send }}
            />
          </section>
          <section aria-label={t.title} className="min-w-0 lg:col-span-3">
            {tickets.length === 0 ? (
              <p className="glass-subtle rounded-2xl p-6 text-muted">{t.empty}</p>
            ) : (
              <ul className="space-y-3">
                {tickets.map((tk) => (
                  <li key={tk.id}>
                    <Link href={localizePath(`/account/support/${tk.id}`, locale)} className="glass glow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
                      <span className="min-w-0">
                        <span className="block font-semibold text-charcoal-900" dir="auto">{tk.subject}</span>
                        <span className="text-xs text-muted">
                          {tk.course ? `${title(tk.course)} · ` : ""}
                          {format(t.updated, { date: fmt.format(tk.updatedAt) })}
                        </span>
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone[tk.status]}`}>{t.statuses[tk.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
