import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/forms/Field";
import { NewsletterButton } from "@/components/layout/NewsletterButtons";
import { Section } from "@/components/ui/Section";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { pendingEmail } from "@/modules/newsletter/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter", robots: { index: false, follow: false } };

export default async function ConfirmPage({ params, searchParams }: PageProps<"/[lang]/newsletter/confirm">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).newsletter;
  const token = String((await searchParams).token ?? "");
  const email = await pendingEmail(token).catch(() => null);
  return (
    <Section>
      <div className="glass-strong mx-auto max-w-lg space-y-4 rounded-3xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-charcoal-900">{t.confirmTitle}</h1>
        {email ? (
          <>
            <p className="text-charcoal-700">{format(t.confirmText, { email })}</p>
            <NewsletterButton kind="confirm" token={token} label={t.confirmButton} done={t.confirmed} failed={t.expired} />
          </>
        ) : (
          <FormAlert tone="info">{t.expired}</FormAlert>
        )}
      </div>
    </Section>
  );
}
