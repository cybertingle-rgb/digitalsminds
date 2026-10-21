"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./errors";
import { GoogleButton } from "./GoogleButton";

type Props = {
  t: Dictionary["auth"];
  locale: Locale;
  verifiedCallback: string;
  googleEnabled: boolean;
  googleCallback: string;
  googleErrorUrl: string;
};

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
    googleEmail: z.union([z.literal(""), z.email().max(254)]),
    phone: z.string().trim().regex(/^[+()\-\s\d]{6,40}$/),
    city: z.string().trim().min(2).max(80),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"] });

type FieldName = "name" | "email" | "password" | "confirmPassword" | "googleEmail" | "phone" | "city";

export function RegisterForm({ t, locale, verifiedCallback, googleEnabled, googleCallback, googleErrorUrl }: Props) {
  const [invalid, setInvalid] = useState<Set<FieldName>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const messages: Record<FieldName, string> = {
    name: t.errors.name,
    email: t.errors.email,
    password: t.errors.passwordTooShort,
    confirmPassword: t.errors.passwordMismatch,
    googleEmail: t.errors.googleEmail,
    phone: t.errors.phone,
    city: t.errors.city,
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => i.path[0] as FieldName)));
      return;
    }
    setInvalid(new Set());
    setError(null);
    setBusy(true);
    const v = parsed.data;
    const { error } = await authClient.signUp.email({
      name: v.name,
      email: v.email.toLowerCase(),
      password: v.password,
      googleEmail: v.googleEmail || v.email.toLowerCase(),
      phone: v.phone,
      city: v.city,
      preferredLocale: locale,
      callbackURL: verifiedCallback,
    } as Parameters<typeof authClient.signUp.email>[0]);
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error, t.errors));
      return;
    }
    setSentTo(v.email);
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-xl bg-green-50 p-6 text-green-900">
        <h2 className="text-lg font-semibold">{t.checkEmailTitle}</h2>
        <p className="mt-2">{format(t.checkEmailText, { email: sentTo })}</p>
      </div>
    );
  }

  const err = (n: FieldName) => (invalid.has(n) ? messages[n] : undefined);
  const a11y = (n: FieldName, hint?: string) => ({ "aria-invalid": invalid.has(n), "aria-describedby": describedBy(n, err(n), hint) });

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <GoogleButton label={t.continueWithGoogle} callbackURL={googleCallback} errorCallbackURL={googleErrorUrl} />
          <p className="flex items-center gap-3 text-xs uppercase text-muted">
            <span className="h-px flex-1 bg-line" />
            {t.or}
            <span className="h-px flex-1 bg-line" />
          </p>
        </>
      )}
      <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t.name} name="name" error={err("name")}>
          <input id="name" name="name" autoComplete="name" required maxLength={120} className={inputClass} {...a11y("name")} />
        </Field>
        <Field label={t.email} name="email" error={err("email")}>
          <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required maxLength={254} className={inputClass} {...a11y("email")} />
        </Field>
        <Field label={t.password} name="password" error={err("password")} hint={t.passwordHint}>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className={inputClass} {...a11y("password", t.passwordHint)} />
        </Field>
        <Field label={t.confirmPassword} name="confirmPassword" error={err("confirmPassword")}>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} {...a11y("confirmPassword")} />
        </Field>
        <Field label={t.googleEmail} name="googleEmail" error={err("googleEmail")} hint={t.googleEmailHint}>
          <input id="googleEmail" name="googleEmail" type="email" dir="ltr" maxLength={254} className={inputClass} {...a11y("googleEmail", t.googleEmailHint)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.phone} name="phone" error={err("phone")}>
            <input id="phone" name="phone" type="tel" dir="ltr" autoComplete="tel" required maxLength={40} className={inputClass} {...a11y("phone")} />
          </Field>
          <Field label={t.city} name="city" error={err("city")}>
            <input id="city" name="city" autoComplete="address-level2" required minLength={2} maxLength={80} className={inputClass} {...a11y("city")} />
          </Field>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" className="w-full" disabled={busy}>
          {t.registerButton}
        </Button>
      </form>
    </div>
  );
}
