"use client";

import { useState, type FormEvent } from "react";
import { Field, FormAlert, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({ t, resetPath }: { t: Dictionary["auth"]; resetPath: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "limited">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: resetPath });
    // Same message whether or not the account exists, so emails can't be probed.
    setState(error?.status === 429 ? "limited" : "sent");
  }

  if (state === "sent") return <FormAlert tone="success">{t.forgotSent}</FormAlert>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t.email} name="email">
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required className={inputClass} />
      </Field>
      {state === "limited" && <FormAlert>{t.errors.tooManyAttempts}</FormAlert>}
      <Button type="submit" className="w-full" disabled={state === "busy"}>
        {t.forgotButton}
      </Button>
    </form>
  );
}
