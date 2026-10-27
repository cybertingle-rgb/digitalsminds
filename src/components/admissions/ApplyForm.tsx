"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { track } from "@/components/analytics/track";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";

type Labels = Dictionary["apply"];
type ErrorKey = keyof Labels["errors"];

/** Splits "{terms}"-style placeholders into links. */
function withLinks(text: string, links: Record<string, ReactNode>) {
  return text.split(/(\{[a-z]+\})/).map((part, i) => {
    const key = /^\{([a-z]+)\}$/.exec(part)?.[1];
    return key && links[key] ? <span key={i}>{links[key]}</span> : <span key={i}>{part}</span>;
  });
}

/** The enrollment application (posts multipart to /api/applications). */
export function ApplyForm(props: {
  batches: { id: string; label: string }[];
  selected: string;
  labels: Labels;
  links: { terms: string; refund: string; privacy: string };
}) {
  const t = props.labels;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; reference: string } | null>(null);
  const [error, setError] = useState<{ key: ErrorKey; field?: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", { method: "POST", body: new FormData(e.currentTarget) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; field?: string; email?: string; reference?: string } | null;
      if (res.ok && json?.ok) {
        track("enrollment_request", {});
        setDone({ email: json.email ?? "", reference: json.reference ?? "" });
        window.scrollTo({ top: 0, behavior: "smooth" });
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

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <h2 className="text-xl font-bold text-charcoal-900">{t.sentTitle}</h2>
        <p className="text-charcoal-800">{format(t.sentText, { email: done.email, reference: done.reference })}</p>
        <p className="text-sm text-muted">{t.sentSpam}</p>
      </div>
    );
  }

  const fieldError = (field: string) => (error?.field === field ? t.errors[error.key] : undefined);
  const aria = (field: string, hint?: string) => ({ "aria-invalid": fieldError(field) ? true : undefined, "aria-describedby": describedBy(field, fieldError(field), hint) });
  const linkClass = "font-semibold text-charcoal-900 underline underline-offset-4";
  const formFields = ["batchId", "name", "email", "phone", "city", "cnic", "cv", "acceptTerms"];

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5" noValidate encType="multipart/form-data">
      <Field label={t.batch} name="batchId" error={fieldError("batchId")}>
        <select id="batchId" name="batchId" defaultValue={props.selected} required className={inputClass} {...aria("batchId")}>
          {props.batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.name} name="name" error={fieldError("name")}>
          <input id="name" name="name" required maxLength={120} autoComplete="name" dir="auto" className={inputClass} {...aria("name")} />
        </Field>
        <Field label={t.email} name="email" hint={t.emailHint} error={fieldError("email")}>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" dir="ltr" className={inputClass} {...aria("email", t.emailHint)} />
        </Field>
        <Field label={t.phone} name="phone" error={fieldError("phone")}>
          <input id="phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" dir="ltr" className={inputClass} {...aria("phone")} />
        </Field>
        <Field label={t.city} name="city" error={fieldError("city")}>
          <input id="city" name="city" required maxLength={80} autoComplete="address-level2" dir="auto" className={inputClass} {...aria("city")} />
        </Field>
        <Field label={t.cnic} name="cnic" hint={t.cnicHint} error={fieldError("cnic")}>
          <input id="cnic" name="cnic" required inputMode="numeric" maxLength={15} autoComplete="off" dir="ltr" placeholder="35202-1234567-1" className={inputClass} {...aria("cnic", t.cnicHint)} />
        </Field>
        <Field label={t.cv} name="cv" hint={t.cvHint} error={fieldError("cv")}>
          <input
            id="cv"
            name="cv"
            type="file"
            required
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className={`${inputClass} file:me-3 file:rounded-lg file:border-0 file:bg-charcoal-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
            {...aria("cv", t.cvHint)}
          />
        </Field>
      </div>
      <Field label={t.message} name="message">
        <textarea id="message" name="message" rows={3} maxLength={1000} dir="auto" className={inputClass} />
      </Field>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm text-charcoal-900">
          <input id="acceptTerms" name="acceptTerms" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-charcoal-900" {...aria("acceptTerms")} />
          <span>
            {withLinks(t.terms, {
              terms: <Link href={props.links.terms} target="_blank" className={linkClass}>{t.termsLink}</Link>,
              refund: <Link href={props.links.refund} target="_blank" className={linkClass}>{t.refundLink}</Link>,
            })}
          </span>
        </label>
        {fieldError("acceptTerms") && <p id="acceptTerms-error" className="mt-1 text-sm text-red-700">{fieldError("acceptTerms")}</p>}
      </div>
      <p className="text-xs text-muted">{withLinks(t.privacyNote, { privacy: <Link href={props.links.privacy} target="_blank" className="underline underline-offset-4">{t.privacyLink}</Link> })}</p>
      {error && !formFields.includes(error.field ?? "") && <FormAlert>{t.errors[error.key]}</FormAlert>}
      <Button type="submit" className="w-full sm:w-auto" disabled={busy}>{busy ? t.sending : t.submit}</Button>
    </form>
  );
}
