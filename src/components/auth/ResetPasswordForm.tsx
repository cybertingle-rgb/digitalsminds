"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "./errors";

export function ResetPasswordForm({ t, token, loginHref }: { t: Dictionary["auth"]; token: string; loginHref: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 10) return setError(t.errors.passwordTooShort);
    if (password !== form.get("confirmPassword")) return setError(t.errors.passwordMismatch);
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) return setError(error.code === "INVALID_TOKEN" ? t.resetInvalid : authErrorMessage(error, t.errors));
    router.push(`${loginHref}?reset=1`);
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t.password} name="password" hint={t.passwordHint}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className={inputClass} aria-describedby={describedBy("password", undefined, t.passwordHint)} />
      </Field>
      <Field label={t.confirmPassword} name="confirmPassword">
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" className="w-full" disabled={busy}>
        {t.resetButton}
      </Button>
    </form>
  );
}
