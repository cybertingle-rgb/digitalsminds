"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./errors";
import { GoogleButton } from "./GoogleButton";

type Props = {
  t: Dictionary["auth"];
  next: string;
  staffHome: string;
  forgotHref: string;
  googleEnabled: boolean;
  googleErrorUrl: string;
};

export function LoginForm({ t, next, staffHome, forgotHref, googleEnabled, googleErrorUrl }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      // Used for the fresh verification link if the email isn't verified yet.
      callbackURL: next,
    });
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error, t.errors));
      return;
    }
    const role = (data?.user as { role?: string } | undefined)?.role;
    const isStaff = role && role !== "STUDENT";
    // Full navigation so server components see the new session cookie. Better Auth
    // already navigates to callbackURL (`next`); a second navigation to the same
    // page would cancel the first, so only step in when staff go elsewhere.
    const target = isStaff && next.endsWith("/account") ? staffHome : next;
    if (target !== next || !(data as { redirect?: boolean } | undefined)?.redirect) window.location.assign(target);
  }

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <GoogleButton label={t.continueWithGoogle} callbackURL={next} errorCallbackURL={googleErrorUrl} />
          <p className="flex items-center gap-3 text-xs uppercase text-muted">
            <span className="h-px flex-1 bg-line" />
            {t.or}
            <span className="h-px flex-1 bg-line" />
          </p>
        </>
      )}
      <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.email} name="email">
          <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label={t.password} name="password">
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} aria-describedby={describedBy("password")} />
        </Field>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" className="w-full" disabled={busy}>
          {t.loginButton}
        </Button>
        <p className="text-center text-sm">
          <Link href={forgotHref} className="text-charcoal-900 underline-offset-4 hover:underline">
            {t.forgotPassword}
          </Link>
        </p>
      </form>
    </div>
  );
}
