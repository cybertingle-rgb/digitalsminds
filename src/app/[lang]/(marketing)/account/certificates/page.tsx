import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { studentCertificates } from "@/modules/certificates/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My certificates", robots: noindex };

export default async function MyCertificatesPage({ params }: PageProps<"/[lang]/account/certificates">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/certificates", locale))}`);
  const t = dict.account;
  const certs = await studentCertificates(user.id);
  const dateFmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "long", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-charcoal-900">{dict.certificates.mine}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t.certificatesIntro}</p>
      </div>
      {certs.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-charcoal-900">{t.certificatesEmpty}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => (
            <li key={c.id}>
              <Link href={localizePath(`/certificates/${c.code}`, locale)} className="glass-sun glow-card group flex h-full flex-col rounded-3xl p-6">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal-900 text-xl text-sun-400">★</span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wider">{dict.certificates.heading}</span>
                <span className="mt-1 text-lg font-bold" dir="auto">{c.courseTitle}</span>
                <span className="mt-1 text-sm">{dateFmt.format(c.issuedAt)}</span>
                <span className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs">
                  <span className="font-mono" dir="ltr">{c.code}</span>
                  <span className="font-semibold underline underline-offset-4 group-hover:no-underline">{t.viewCertificate}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
