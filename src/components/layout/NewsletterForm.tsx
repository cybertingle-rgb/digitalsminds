"use client";

import { useState } from "react";

type Labels = { label: string; button: string; sent: string; invalid: string; tooMany: string; error: string };

/** Footer sign-up (the page itself is static; this posts to /api/newsletter). */
export function NewsletterForm({ locale, labels }: { locale: string; labels: Labels }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  return (
    <form
      noValidate
      className="w-full max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setState("error");
          setMessage(labels.invalid);
          return;
        }
        setState("sending");
        try {
          const res = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, locale, source: window.location.pathname, website: fd.get("website") }),
          });
          if (res.ok) {
            setState("sent");
            setMessage(labels.sent);
          } else {
            setState("error");
            setMessage(res.status === 429 ? labels.tooMany : res.status === 422 ? labels.invalid : labels.error);
          }
        } catch {
          setState("error");
          setMessage(labels.error);
        }
      }}
    >
      {state === "sent" ? (
        <p role="status" className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium text-charcoal-900 ring-1 ring-white">{message}</p>
      ) : (
        <>
          <div className="flex gap-2 rounded-2xl bg-white/80 p-1.5 ring-1 ring-white focus-within:ring-2 focus-within:ring-sun-400">
            <label htmlFor="newsletter-email" className="sr-only">{labels.label}</label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder={labels.label}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-charcoal-900 placeholder:text-charcoal-600 focus:outline-none"
              aria-invalid={state === "error" || undefined}
              aria-describedby={state === "error" ? "newsletter-msg" : undefined}
            />
            {/* Honeypot for bots; hidden from people and screen readers. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" />
            <button type="submit" disabled={state === "sending"} className="border-run rounded-xl bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-charcoal-800 disabled:opacity-60">
              {labels.button}
            </button>
          </div>
          {state === "error" && <p id="newsletter-msg" role="alert" className="mt-2 text-sm text-red-700">{message}</p>}
        </>
      )}
    </form>
  );
}
