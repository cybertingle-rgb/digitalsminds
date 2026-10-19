"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { hasLocale, localizePath, type Locale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { ur } from "@/i18n/dictionaries/ur";

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const locale: Locale = params?.lang && hasLocale(params.lang) ? params.lang : "en";
  const t = { ...en.errors, ...(locale === "ur" ? ur.errors : {}) };

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold text-charcoal-900">{t.errorTitle}</h1>
      <p className="mt-4 text-muted">{t.errorText}</p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted">
          {t.reference}: <span dir="ltr">{error.digest}</span>
        </p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>{t.tryAgain}</Button>
        <LinkButton href={localizePath("/", locale)} variant="secondary">
          {t.goHome}
        </LinkButton>
      </div>
    </Container>
  );
}
