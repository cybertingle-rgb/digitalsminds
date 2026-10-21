"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";

type Labels = Dictionary["payments"];
type ErrorKey = keyof Labels["errors"];

/** Transaction details + receipt for an application (posts to /api/applications/payment). */
export function ApplicationPayForm(props: { methods: { value: string; label: string }[]; labels: Labels }) {
  const t = props.labels;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ key: ErrorKey; field?: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applications/payment", { method: "POST", body: new FormData(e.currentTarget) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; field?: string } | null;
      if (res.ok && json?.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      const key = (json?.error && json.error in t.errors ? json.error : "generic") as ErrorKey;
      setError({ key, field: json?.field });
    } catch {
      setError({ key: "generic" });
    } finally {
      setBusy(false);
    }
  }

  if (done) return <FormAlert tone="success">{t.sent}</FormAlert>;

  const err = (field: string) => (error?.field === field ? t.errors[error.key] : undefined);
  const aria = (field: string, hint?: string) => ({ "aria-invalid": err(field) ? true : undefined, "aria-describedby": describedBy(field, err(field), hint) });

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate encType="multipart/form-data">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-charcoal-900">{t.method}</legend>
        <div className="flex flex-wrap gap-2">
          {props.methods.map((m, i) => (
            <label key={m.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-charcoal-900 has-[:checked]:border-charcoal-900 has-[:checked]:bg-sun-100">
              <input type="radio" name="method" value={m.value} defaultChecked={i === 0} required className="h-4 w-4 accent-charcoal-900" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.reference} name="reference" hint={t.referenceHint} error={err("reference")}>
          <input id="reference" name="reference" required minLength={3} maxLength={100} dir="ltr" autoComplete="off" className={inputClass} {...aria("reference", t.referenceHint)} />
        </Field>
        <Field label={t.paidOn} name="paidOn" error={err("paidOn")}>
          <input id="paidOn" name="paidOn" type="date" required max={today} defaultValue={today} className={inputClass} {...aria("paidOn")} />
        </Field>
      </div>
      <Field label={t.payerName} name="payerName">
        <input id="payerName" name="payerName" maxLength={120} autoComplete="name" dir="auto" className={inputClass} />
      </Field>
      <Field label={t.receipt} name="receipt" hint={t.receiptHint} error={err("receipt")}>
        <input id="receipt" name="receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className={`${inputClass} file:me-3 file:rounded-lg file:border-0 file:bg-charcoal-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`} {...aria("receipt", t.receiptHint)} />
      </Field>
      <Field label={t.note} name="note">
        <textarea id="note" name="note" rows={3} maxLength={1000} dir="auto" className={inputClass} />
      </Field>
      {error && !["reference", "paidOn", "receipt"].includes(error.field ?? "") && <FormAlert>{t.errors[error.key]}</FormAlert>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? t.sending : t.submit}</Button>
    </form>
  );
}
