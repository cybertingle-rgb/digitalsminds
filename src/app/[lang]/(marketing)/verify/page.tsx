import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";
import { certificateByCode, normaliseCode } from "@/modules/certificates/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/verify">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).certificates;
  return pageMetadata(lang, "/verify", { title: t.verifyTitle, description: t.verifyIntro });
}

/** Look up a certificate by its printed ID (plain GET form, works without JavaScript). */
export default async function VerifyPage({ params, searchParams }: PageProps<"/[lang]/verify">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).certificates;
  const sp = await searchParams;
  const typed = typeof sp.code === "string" ? sp.code.slice(0, 40) : "";
  let missing = false;
  if (typed) {
    const code = normaliseCode(typed);
    if (code && (await certificateByCode(code))) redirect(localizePath(`/certificates/${code}`, lang));
    missing = true;
  }
  return (
    <Section>
      <div className="glass-strong mx-auto max-w-xl rounded-3xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-charcoal-900 sm:text-3xl">{t.verifyTitle}</h1>
        <p className="mt-2 text-charcoal-700">{t.verifyIntro}</p>
        <form className="mt-6 space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-charcoal-900">{t.verifyLabel}</label>
            <input id="code" name="code" defaultValue={typed} required dir="ltr" placeholder="DM-XXXX-XXXX" autoComplete="off" className={`${inputClass} uppercase tracking-wider`} aria-invalid={missing || undefined} />
          </div>
          {missing && <FormAlert>{t.notFound}</FormAlert>}
          <Button type="submit" className="w-full">{t.verifyButton}</Button>
        </form>
      </div>
    </Section>
  );
}
