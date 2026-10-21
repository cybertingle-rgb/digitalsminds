import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/admissions/ApplyForm";
import { Section } from "@/components/ui/Section";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { formatDay } from "@/modules/batches/rules";
import { publicBatches } from "@/modules/batches/service";
import { courseBySlug } from "@/modules/learning/catalogue";
import { coursePrice, formatPkr } from "@/modules/payments/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply", robots: { index: false, follow: true } };

export default async function ApplyPage({ params, searchParams }: PageProps<"/[lang]/courses/[slug]/apply">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.apply;
  const course = await courseBySlug(slug);
  const price = course ? coursePrice(course) : null;
  if (!course || course.status !== "PUBLISHED" || !price) notFound();
  const open = (await publicBatches(course.id)).filter((b) => b.open === "open");
  const sp = await searchParams;
  const selected = open.find((b) => b.id === sp.batch)?.id ?? open[0]?.id ?? "";
  const back = localizePath(`/courses/${course.slug}`, lang);

  return (
    <Section className="!py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <nav aria-label={dict.a11y.breadcrumb} className="text-sm text-muted">
          <Link href={back} className="hover:text-charcoal-900">← {course.title}</Link>
        </nav>
        <div>
          <h1 className="text-3xl font-bold text-charcoal-900" dir="auto">{format(t.formTitle, { program: course.title })}</h1>
          <p className="mt-2 text-muted">{t.formIntro}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-sun-100 px-3 py-1 text-sm font-semibold text-charcoal-900">
            {t.fee}: <span dir="ltr">{formatPkr(price)}</span>
          </p>
        </div>
        <div className="glass rounded-3xl p-6 sm:p-8">
          {open.length === 0 ? (
            <p className="text-charcoal-800">{t.noBatches}</p>
          ) : (
            <ApplyForm
              batches={open.map((b) => ({ id: b.id, label: `${b.name} · ${format(t.starts, { date: formatDay(b.startDate) })} · ${b.scheduleText}` }))}
              selected={selected}
              labels={t}
              links={{ terms: localizePath("/terms", lang), refund: localizePath("/refund-policy", lang), privacy: localizePath("/privacy", lang) }}
            />
          )}
        </div>
      </div>
    </Section>
  );
}
