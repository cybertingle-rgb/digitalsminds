import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyField } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { staffTicket } from "@/modules/support/service";
import { ReplyForm, StatusControl } from "../TicketForms";

export const metadata: Metadata = { title: "Support request" };

const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function TicketAdminPage({ params }: PageProps<"/[lang]/admin/support/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/support/${id}`);
  if (!can(user.role, "support.manage.all") && !can(user.role, "support.manage.own")) notFound();
  const ticket = await staffTicket(id, user);
  if (!ticket) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/support" className="text-sm text-muted hover:text-charcoal-900">← All support requests</Link>
      <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{ticket.subject}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ol className="space-y-3" aria-label="Conversation">
            {ticket.messages.map((m) => {
              const fromStudent = m.authorId === ticket.user.id;
              return (
                <li key={m.id} className={`rounded-2xl p-5 ${m.internal ? "border border-dashed border-sun-500 bg-sun-50/80" : fromStudent ? "glass me-8" : "glass-sun ms-8"}`}>
                  <p className="text-xs font-semibold text-charcoal-700">
                    {m.internal ? "Internal note · " : ""}
                    {m.author?.name ?? "Former team member"} · {timeFmt.format(m.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-charcoal-900" dir="auto">{m.body}</p>
                </li>
              );
            })}
          </ol>
          <section className="glass rounded-2xl p-5">
            <ReplyForm id={ticket.id} closed={ticket.status === "CLOSED"} />
          </section>
        </div>
        <aside className="min-w-0 space-y-4">
          <section className="glass space-y-4 rounded-2xl p-5">
            <StatusControl id={ticket.id} status={ticket.status} />
          </section>
          <section className="glass space-y-3 rounded-2xl p-5 text-sm">
            <p className="font-semibold text-charcoal-900" dir="auto">{ticket.user.name}</p>
            <p className="text-muted" dir="ltr">{ticket.user.email}</p>
            {ticket.user.googleEmail && <CopyField label="Google email" value={ticket.user.googleEmail} />}
            <p>Course: {ticket.course ? <Link href={`/admin/courses/${ticket.course.id}`} className="underline underline-offset-4">{ticket.course.title}</Link> : "General"}</p>
            {ticket.user.role === "STUDENT" && can(user.role, "students.view") && (
              <Link href={`/admin/students/${ticket.user.id}`} className="font-semibold underline underline-offset-4">Student profile</Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
