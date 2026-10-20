import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CertificateActions } from "@/components/learning/CertificateActions";
import { FormAlert } from "@/components/forms/Field";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { certificateByCode, normaliseCode } from "@/modules/certificates/service";
import { getLogos } from "@/modules/content/settings";

export const dynamic = "force-dynamic";
// Certificates are shared by link, not listed in search engines.
export const metadata: Metadata = { title: "Certificate", robots: { index: false, follow: false } };

/** Public certificate and verification page (name, course, date and ID only). */
export default async function CertificatePage({ params }: PageProps<"/[lang]/certificates/[code]">) {
  const { lang, code: raw } = await params;
  if (!hasLocale(lang)) notFound();
  const code = normaliseCode(decodeURIComponent(raw));
  if (!code) notFound();
  if (code !== raw) redirect(localizePath(`/certificates/${code}`, lang));
  const cert = await certificateByCode(code);
  if (!cert) notFound();
  const dict = getDictionary(lang);
  const t = dict.certificates;
  const date = new Intl.DateTimeFormat(localeMeta[lang].intl, { dateStyle: "long", timeZone: "Asia/Karachi" }).format(cert.issuedAt);
  const verifyUrl = `${siteConfig.url.replace(/^https?:\/\//, "")}${localizePath("/verify", lang)}`;

  return (
    <Container className="py-8 sm:py-12 print:p-0">
      {cert.revokedAt ? (
        <div className="mx-auto max-w-2xl">
          <FormAlert>{t.revoked}</FormAlert>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
            <p className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-900">
              <span aria-hidden="true">✓</span> {t.valid} · <span dir="ltr">{cert.code}</span>
            </p>
            <CertificateActions labels={{ print: t.print, hint: t.printHint, share: t.share, copied: t.copied }} />
          </div>

          {/* A4 landscape proportions; prints edge to edge. */}
          <article className="dm-certificate relative mx-auto aspect-[297/210] w-full overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgb(43_50_60/0.45)] print:rounded-none print:shadow-none">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_0%,rgb(253_207_49/0.35),transparent_70%),radial-gradient(50%_50%_at_100%_100%,rgb(253_207_49/0.3),transparent_70%)]" />
            <div aria-hidden="true" className="absolute inset-[3%] rounded-2xl border-2 border-sun-400" />
            <div aria-hidden="true" className="absolute inset-[4.2%] rounded-xl border border-charcoal-900/15" />
            <div className="relative flex h-full flex-col items-center justify-between px-[8%] py-[6%] text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={(await getLogos()).light.src} alt={dict.brand.name} className="h-[11%] w-auto" />
              <div className="flex flex-col items-center gap-[0.6em] text-[clamp(10px,1.6vw,18px)]">
                <p className="text-[1.9em] font-bold uppercase tracking-[0.18em] text-charcoal-900">{t.heading}</p>
                <span aria-hidden="true" className="h-[3px] w-24 rounded-full bg-sun-400" />
                <p className="text-[1em] text-charcoal-600">{t.certifies}</p>
                <p className="text-[2.6em] font-bold leading-tight text-charcoal-900" dir="auto">{cert.recipientName}</p>
                <p className="text-[1em] text-charcoal-600">{t.completed}</p>
                <p className="text-[1.6em] font-semibold leading-snug text-charcoal-900" dir="auto" lang={cert.course.language}>{cert.courseTitle}</p>
              </div>
              <div className="grid w-full grid-cols-3 items-end gap-4 text-[clamp(8px,1.1vw,13px)] text-charcoal-700">
                <div className="text-start">
                  <p className="font-semibold text-charcoal-900">{format(t.issuedOn, { date })}</p>
                </div>
                <div>
                  <p className="mx-auto mb-1 w-3/4 border-t border-charcoal-900/40" />
                  <p className="font-semibold text-charcoal-900">{t.signature}</p>
                  <p>{dict.brand.tagline}</p>
                </div>
                <div className="text-end">
                  <p>{t.id}: <span className="font-semibold text-charcoal-900" dir="ltr">{cert.code}</span></p>
                  <p dir="auto">{format(t.verifyAt, { url: verifyUrl })}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </Container>
  );
}
