import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { requirePagePermission } from "@/modules/auth/session";
import { issuedCertificates, readyToIssue } from "@/modules/certificates/service";
import { IssueButton, RevokeButton } from "./CertificateButtons";

export const metadata: Metadata = { title: "Certificates" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function CertificatesPage({ searchParams }: PageProps<"/[lang]/admin/certificates">) {
  await requirePagePermission("certificates.issue", "/admin/certificates");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const [ready, issued] = await Promise.all([readyToIssue(), issuedCertificates(q || undefined)]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Certificates</h1>
        <p className="mt-1 text-muted">
          Students who complete every lesson of a course with certificates turned on appear here for a quick review. Issuing emails the
          student a link to their certificate, which anyone can verify by its ID.
        </p>
      </div>

      <section aria-labelledby="ready">
        <h2 id="ready" className="text-lg font-semibold text-charcoal-900">Ready to issue ({ready.length})</h2>
        {ready.length === 0 ? (
          <p className="glass-subtle mt-3 rounded-2xl p-6 text-sm text-muted">Nobody is waiting for a certificate.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {ready.map((e) => (
              <li key={e.id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5" aria-label={`${e.user.name}: ${e.course.title}`}>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-charcoal-900" dir="auto">{e.user.name}</p>
                  <p className="text-muted" dir="ltr">{e.user.email}</p>
                  <p className="mt-1" dir="auto">{e.course.title} · completed {dateFmt.format(e.completedAt!)}</p>
                  <Link href={`/admin/students/${e.user.id}`} className="text-xs underline underline-offset-4">Check progress</Link>
                </div>
                <IssueButton enrollmentId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="issued" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="issued" className="text-lg font-semibold text-charcoal-900">Issued</h2>
          <form className="flex items-end gap-2" role="search">
            <label htmlFor="q" className="sr-only">Search certificates</label>
            <input id="q" name="q" defaultValue={q} placeholder="ID, name or course" className={`${inputClass} mt-0 w-56`} />
            <button type="submit" className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Search</button>
          </form>
        </div>
        {issued.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-sm text-muted">No certificates issued yet.</p>
        ) : (
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/70 bg-white/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">ID</th>
                  <th scope="col" className="px-4 py-3">Student</th>
                  <th scope="col" className="px-4 py-3">Course</th>
                  <th scope="col" className="px-4 py-3">Issued</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-200/50">
                {issued.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><a href={`/certificates/${c.code}`} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4" dir="ltr">{c.code}</a></td>
                    <td className="px-4 py-3" dir="auto">{c.recipientName}</td>
                    <td className="px-4 py-3" dir="auto">{c.courseTitle}</td>
                    <td className="px-4 py-3 text-muted">{dateFmt.format(c.issuedAt)}</td>
                    <td className="px-4 py-3 text-end">{c.revokedAt ? <StatusBadge tone="off">Revoked</StatusBadge> : <RevokeButton id={c.id} code={c.code} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
