import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/forms/Field";
import { NewsletterButton } from "@/components/layout/NewsletterButtons";
import { Section } from "@/components/ui/Section";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { subscriberByToken } from "@/modules/newsletter/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[lang]/newsletter/unsubscribe">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang).newsletter;
  const token = String((await searchParams).token ?? "");
  const sub = await subscriberByToken(token).catch(() => null);
  return (
    <Section>
      <div className="glass-strong mx-auto max-w-lg space-y-4 rounded-3xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-charcoal-900">{t.unsubscribeTitle}</h1>
        {!sub ? (
          <FormAlert tone="info">{t.unknown}</FormAlert>
        ) : sub.status === "UNSUBSCRIBED" ? (
          <FormAlert tone="success">{t.unsubscribed}</FormAlert>
        ) : (
          <>
            <p className="text-charcoal-700">{format(t.unsubscribeText, { email: sub.email })}</p>
            <NewsletterButton kind="unsubscribe" token={token} label={t.unsubscribeButton} done={t.unsubscribed} failed={t.unknown} />
          </>
        )}
      </div>
    </Section>
  );
}
