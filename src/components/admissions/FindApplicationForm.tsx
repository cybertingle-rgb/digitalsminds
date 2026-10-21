"use client";

import { useState, type FormEvent } from "react";
import { Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";

/** "Email me a new link" (posts to /api/applications/link). The answer never says whether an application exists. */
export function FindApplicationForm({ labels: t, errors }: { labels: Dictionary["apply"]; errors: Dictionary["auth"]["errors"] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "tooMany" | "invalid" | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/applications/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), reference: form.get("reference") }),
      });
      setResult(res.ok ? "sent" : res.status === 429 ? "tooMany" : "invalid");
    } catch {
      setResult("invalid");
    } finally {
      setBusy(false);
    }
  }

  if (result === "sent") return <FormAlert tone="success">{t.findSent}</FormAlert>;
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.email} name="find-email">
          <input id="find-email" name="email" type="email" required maxLength={254} autoComplete="email" dir="ltr" className={inputClass} />
        </Field>
        <Field label={t.reference} name="find-reference">
          <input id="find-reference" name="reference" required maxLength={20} autoComplete="off" dir="ltr" placeholder="DM-XXXX-XXXX" className={`${inputClass} uppercase`} />
        </Field>
      </div>
      {result === "tooMany" && <FormAlert>{errors.tooManyAttempts}</FormAlert>}
      {result === "invalid" && <FormAlert>{errors.generic}</FormAlert>}
      <Button type="submit" variant="secondary" disabled={busy}>{t.findButton}</Button>
    </form>
  );
}
