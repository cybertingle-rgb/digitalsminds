"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { readCampaign } from "@/components/analytics/CampaignCapture";
import { track } from "@/components/analytics/track";
import { inquiryInputSchema } from "@/modules/inquiries/schema";

type Strings = Dictionary["form"];
type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "success" } | { kind: "error"; message: string };

const inputClass =
  "mt-1 block w-full rounded-xl border border-white/80 bg-white/60 shadow-sm px-3 py-2.5 text-charcoal-900 shadow-sm focus:border-charcoal-900 focus:outline-none focus:ring-2 focus:ring-sun-400 aria-[invalid=true]:border-red-600";

const FIELDS = ["name", "email", "phone", "company", "service", "message"] as const;
type Field = (typeof FIELDS)[number];

type Props = {
  strings: Strings;
  services: { slug: string; title: string }[];
  defaultService?: string;
};

export function InquiryForm({ strings, services, defaultService = "general" }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [invalid, setInvalid] = useState<Set<Field>>(new Set());

  function invalidFields(details: Record<string, unknown>) {
    return new Set(FIELDS.filter((f) => f in details));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      ...Object.fromEntries(new FormData(form)),
      source: window.location.pathname,
      locale: document.documentElement.lang === "ur" ? "ur" : "en",
      ...readCampaign(),
    };

    const parsed = inquiryInputSchema.safeParse(data);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => i.path[0]).filter((p): p is Field => FIELDS.includes(p as Field))));
      setStatus({ kind: "idle" });
      return;
    }

    setInvalid(new Set());
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        form.reset();
        track("generate_lead", { service: parsed.data.service });
        setStatus({ kind: "success" });
        return;
      }
      if (json?.error?.details) setInvalid(invalidFields(json.error.details));
      setStatus({ kind: "error", message: res.status === 429 ? strings.errors.rateLimited : strings.errors.generic });
    } catch {
      setStatus({ kind: "error", message: strings.errors.network });
    }
  }

  if (status.kind === "success") {
    return (
      <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-8">
        <h2 className="text-xl font-semibold text-green-900">{strings.successTitle}</h2>
        <p className="mt-2 text-green-800">{strings.successText}</p>
        <Button variant="secondary" className="mt-6" onClick={() => setStatus({ kind: "idle" })}>
          {strings.sendAnother}
        </Button>
      </div>
    );
  }

  const aria = (name: Field) => ({
    "aria-invalid": invalid.has(name),
    "aria-describedby": invalid.has(name) ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={strings.name} name="name" error={invalid.has("name") ? strings.errors.name : undefined}>
          <input id="name" name="name" autoComplete="name" required maxLength={120} className={inputClass} {...aria("name")} />
        </FormField>
        <FormField label={strings.email} name="email" error={invalid.has("email") ? strings.errors.email : undefined}>
          <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required maxLength={254} className={inputClass} {...aria("email")} />
        </FormField>
        <FormField label={strings.phone} name="phone" error={invalid.has("phone") ? strings.errors.phone : undefined}>
          <input id="phone" name="phone" type="tel" dir="ltr" autoComplete="tel" maxLength={40} className={inputClass} {...aria("phone")} />
        </FormField>
        <FormField label={strings.company} name="company" error={invalid.has("company") ? strings.errors.company : undefined}>
          <input id="company" name="company" autoComplete="organization" maxLength={160} className={inputClass} {...aria("company")} />
        </FormField>
      </div>
      <FormField label={strings.service} name="service" error={invalid.has("service") ? strings.errors.service : undefined}>
        <select id="service" name="service" defaultValue={defaultService} className={inputClass} {...aria("service")}>
          <option value="general">{strings.serviceGeneral}</option>
          <option value="ebay-course">{strings.serviceEbayCourse}</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={strings.message} name="message" error={invalid.has("message") ? strings.errors.message : undefined}>
        <textarea id="message" name="message" rows={6} required maxLength={5000} className={inputClass} {...aria("message")} />
      </FormField>

      {/* Honeypot: hidden from people and assistive tech, catches naive bots.
          Clipped in place (sr-only) rather than moved off-screen, which would
          create scrollable overflow on right-to-left pages. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={status.kind === "submitting"} className="w-full sm:w-auto">
        {status.kind === "submitting" ? strings.sending : strings.submit}
      </Button>
      <p className="text-xs text-muted">{strings.privacy}</p>
    </form>
  );
}

function FormField({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-charcoal-900">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
