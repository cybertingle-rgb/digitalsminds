import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { localeMeta, localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { listingText } from "@/modules/learning/catalogue";
import type { myLearning } from "@/modules/learning/progress";
import { mediaUrl } from "@/modules/media/service";

type Learning = Awaited<ReturnType<typeof myLearning>>[number];

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-charcoal-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
      <div className="h-full rounded-full bg-gradient-to-r from-sun-400 to-sun-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Card for an enrolled course with progress and a continue/start button. */
export function CourseProgressCard({ item, locale, dict }: { item: Learning; locale: Locale; dict: Dictionary }) {
  const t = dict.account;
  const { course, percent, done, total, lastLesson, canLearn } = item;
  const text = listingText(course, locale);
  return (
    <li className="glass glow-card flex flex-col overflow-hidden rounded-3xl">
      <div className="relative aspect-video bg-gradient-to-br from-charcoal-800 to-charcoal-950">
        {course.thumbnail?.visibility === "PUBLIC" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(course.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {total > 0 && done === total && <span className="absolute start-3 top-3 rounded-full bg-sun-400 px-3 py-1 text-xs font-bold text-charcoal-900">{t.completed}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-semibold text-charcoal-900" dir="auto">
          <Link href={localizePath(`/courses/${course.slug}`, locale)} className="hover:underline">{text.title}</Link>
        </h3>
        <div>
          <ProgressBar percent={percent} label={text.title} />
          <p className="mt-1 text-xs text-muted">
            {total > 0 && done === total ? t.completed : format(t.progress, { percent: String(percent) })} · {format(dict.learn.progress, { done: String(done), total: String(total) })}
          </p>
        </div>
        {lastLesson && <p className="text-xs text-muted" dir="auto">{format(t.lastLesson, { lesson: lastLesson.title })}</p>}
        <div className="mt-auto">
          {canLearn ? (
            <LinkButton href={localizePath(`/learn/${course.slug}`, locale)} className="w-full py-2">{lastLesson ? t.continue : t.start}</LinkButton>
          ) : (
            <p className="text-xs text-muted">{dict.learn.unavailable}</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Access requests and paid-course payments that are still open or were declined. */
export function RequestsList({
  requests,
  payments,
  locale,
  dict,
}: {
  requests: Learning[];
  payments: Map<string, { status: string }>;
  locale: Locale;
  dict: Dictionary;
}) {
  if (requests.length === 0) return null;
  const t = dict.account;
  const dateFmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  const statusLabel = { REQUESTED: t.statusRequested, REJECTED: t.statusRejected, REVOKED: t.statusRevoked, APPROVED: "" } as const;
  const paymentLabel = { PENDING: dict.payments.statusPending, CONFIRMED: dict.payments.statusConfirmed, REJECTED: dict.payments.statusRejected } as Record<string, string>;
  return (
    <section aria-labelledby="requests">
      <h2 id="requests" className="text-xl font-bold text-charcoal-900">{t.requests}</h2>
      <ul className="mt-4 glass divide-y divide-charcoal-200/50 rounded-2xl">
        {requests.map(({ course, enrollment }) => {
          const payment = enrollment.status !== "REVOKED" ? payments.get(course.id) : undefined;
          return (
            <li key={enrollment.id} className="flex flex-wrap items-start justify-between gap-3 p-5 text-sm">
              <div className="min-w-0">
                <Link href={localizePath(`/courses/${course.slug}`, locale)} className="font-semibold text-charcoal-900 hover:underline" dir="auto">
                  {listingText(course, locale).title}
                </Link>
                <p className="mt-1 text-xs text-muted">{format(t.requestedOn, { date: dateFmt.format(enrollment.requestedAt) })}</p>
                {enrollment.decisionNote && <p className="mt-2 text-charcoal-800" dir="auto">{format(dict.courses.reason, { note: enrollment.decisionNote })}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enrollment.status === "REQUESTED" ? "bg-sun-100 text-charcoal-900" : "bg-charcoal-100 text-charcoal-800"}`}>
                  {payment ? paymentLabel[payment.status] : statusLabel[enrollment.status]}
                </span>
                {payment?.status === "REJECTED" && enrollment.status === "REJECTED" && (
                  <Link href={localizePath(`/courses/${course.slug}/pay`, locale)} className="text-xs font-semibold text-charcoal-900 underline underline-offset-4">{dict.payments.payAgain}</Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
