"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { services } from "@/content/services";
import { inquiryInputSchema } from "@/modules/inquiries/schema";
import { fieldErrors } from "@/lib/validation";

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "success" } | { kind: "error"; message: string };

const inputClass =
  "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-red-500";

export function InquiryForm({ defaultService = "general" }: { defaultService?: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = { ...Object.fromEntries(new FormData(form)), source: window.location.pathname };

    const parsed = inquiryInputSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus({ kind: "idle" });
      return;
    }

    setErrors({});
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
        setStatus({ kind: "success" });
        return;
      }
      if (json?.error?.details) setErrors(json.error.details);
      setStatus({ kind: "error", message: json?.error?.message ?? "We couldn't send your inquiry. Please try again." });
    } catch {
      setStatus({ kind: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  if (status.kind === "success") {
    return (
      <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-8">
        <h2 className="text-xl font-semibold text-green-900">Thank you, your inquiry has been sent.</h2>
        <p className="mt-2 text-green-800">We&apos;ll review your message and get back to you soon.</p>
        <Button variant="secondary" className="mt-6" onClick={() => setStatus({ kind: "idle" })}>
          Send another inquiry
        </Button>
      </div>
    );
  }

  const err = (name: string) => errors[name]?.[0];
  const describedBy = (name: string) => (err(name) ? `${name}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="name" error={err("name")}>
          <input id="name" name="name" autoComplete="name" required maxLength={120} className={inputClass} aria-invalid={!!err("name")} aria-describedby={describedBy("name")} />
        </Field>
        <Field label="Email" name="email" error={err("email")}>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} aria-invalid={!!err("email")} aria-describedby={describedBy("email")} />
        </Field>
        <Field label="Phone (optional)" name="phone" error={err("phone")}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} aria-invalid={!!err("phone")} aria-describedby={describedBy("phone")} />
        </Field>
        <Field label="Company / brand (optional)" name="company" error={err("company")}>
          <input id="company" name="company" autoComplete="organization" maxLength={160} className={inputClass} aria-invalid={!!err("company")} aria-describedby={describedBy("company")} />
        </Field>
      </div>
      <Field label="What can we help with?" name="service" error={err("service")}>
        <select id="service" name="service" defaultValue={defaultService} className={inputClass} aria-invalid={!!err("service")} aria-describedby={describedBy("service")}>
          <option value="general">General inquiry / not sure yet</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tell us about your project" name="message" error={err("message")}>
        <textarea id="message" name="message" rows={6} required maxLength={5000} className={inputClass} aria-invalid={!!err("message")} aria-describedby={describedBy("message")} />
      </Field>

      {/* Honeypot: hidden from people and assistive tech, catches naive bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={status.kind === "submitting"} className="w-full sm:w-auto">
        {status.kind === "submitting" ? "Sending…" : "Send Inquiry"}
      </Button>
      <p className="text-xs text-muted">We only use your details to respond to your inquiry.</p>
    </form>
  );
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
