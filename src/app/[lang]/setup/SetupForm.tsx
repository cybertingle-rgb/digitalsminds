"use client";

import { Field, FormAlert, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { setupAction, type SetupState } from "./actions";

export function SetupForm({ email }: { email: string }) {
  const [state, onSubmit, pending] = useFormAction<SetupState>(setupAction, {});
  const f = state.fields ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email (Super Admin)" name="email">
        <input id="email" value={email} disabled readOnly className={inputClass} />
      </Field>
      <Field label="Your name" name="name" error={f.name}>
        <input id="name" name="name" required autoComplete="name" className={inputClass} aria-invalid={!!f.name} />
      </Field>
      <Field label="Password" name="password" error={f.password} hint="At least 10 characters. Use a password manager.">
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} aria-invalid={!!f.password} />
      </Field>
      <Field label="Confirm password" name="confirmPassword" error={f.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className={inputClass} aria-invalid={!!f.confirmPassword} />
      </Field>
      <Field label="Setup code" name="code" error={f.code} hint="The ADMIN_SETUP_CODE value from Hostinger's environment variables.">
        <input id="code" name="code" type="password" required autoComplete="off" className={inputClass} aria-invalid={!!f.code} />
      </Field>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create Super Admin account"}
      </Button>
    </form>
  );
}
