"use client";

import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { saveProfileAction, type ProfileState } from "@/app/[lang]/(marketing)/account/actions";

type Profile = { name: string; googleEmail: string; phone: string; city: string; preferredLocale: "en" | "ur" };
type Labels = { name: string; googleEmail: string; googleHint: string; phone: string; city: string; language: string; save: string };

export function ProfileForm({ lang, profile, labels }: { lang: string; profile: Profile; labels: Labels }) {
  const [state, onSubmit, pending] = useFormAction<ProfileState>(saveProfileAction.bind(null, lang), { status: "idle" });
  const err = (k: string) => state.errors?.[k];
  const aria = (k: string, hint?: string) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": describedBy(k, err(k), hint) });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.name} name="name" error={err("name")}>
          <input id="name" name="name" defaultValue={profile.name} required maxLength={120} autoComplete="name" dir="auto" className={inputClass} {...aria("name")} />
        </Field>
        {/* Google email was only used for sharing course videos; the saved value is kept. */}
        <input type="hidden" name="googleEmail" value={profile.googleEmail} />
        <Field label={labels.phone} name="phone" error={err("phone")}>
          <input id="phone" name="phone" type="tel" required dir="ltr" defaultValue={profile.phone} maxLength={40} autoComplete="tel" className={inputClass} {...aria("phone")} />
        </Field>
        <Field label={labels.city} name="city" error={err("city")}>
          <input id="city" name="city" required minLength={2} defaultValue={profile.city} maxLength={80} autoComplete="address-level2" dir="auto" className={inputClass} {...aria("city")} />
        </Field>
<input type="hidden" name="preferredLocale" value="en" />
      </div>
      {state.message && <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>}
      <Button type="submit" variant="dark" disabled={pending}>{labels.save}</Button>
    </form>
  );
}
