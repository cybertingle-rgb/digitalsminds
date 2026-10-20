import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormAlert } from "@/components/forms/Field";
import { StudentReplyForm } from "@/components/learning/SupportForms";
import { Section } from "@/components/ui/Section";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { studentTicket } from "@/modules/support/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support", robots: noindex };

export default async function TicketPage({ params }: PageProps<"/[lang]/account/support/[id]">) {
  const { locale, dict } = await authPage(params);
  const { id } = await params;
  const user = await getCurrentUser();
  const here = localizePath(`/account/support/${id}`, locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const ticket = await studentTicket(id, user.id);
  if (!ticket) notFound();
  const t = dict.support;
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

  return (
    <Section>
      <div className="max-w-3xl space-y-6">
        <Link href={localizePath("/account/support", locale)} className="text-sm text-muted hover:text-charcoal-900">← {t.back}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-charcoal-900 sm:text-3xl" dir="auto">{ticket.subject}</h1>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-charcoal-900 ring-1 ring-white">{t.statuses[ticket.status]}</span>
        </div>
        <ol className="space-y-3">
          {ticket.messages.map((m) => {
            const mine = m.authorId === user.id;
            return (
              <li key={m.id} className={`rounded-2xl p-5 ${mine ? "glass ms-8" : "glass-sun me-8"}`}>
                <p className="text-xs font-semibold text-charcoal-700">
                  {mine ? t.you : t.team} · {fmt.format(m.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-charcoal-900" dir="auto">{m.body}</p>
              </li>
            );
          })}
        </ol>
        {ticket.status === "CLOSED" ? (
          <FormAlert tone="info">{t.closedNote}</FormAlert>
        ) : (
          <div className="glass rounded-2xl p-5">
            <StudentReplyForm lang={locale} ticketId={ticket.id} labels={{ reply: t.yourReply, send: t.send }} />
          </div>
        )}
      </div>
    </Section>
  );
}
