"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { requestAccessAction, type RequestState } from "@/app/[lang]/(marketing)/courses/actions";

type Labels = { googleEmail: string; googleHint: string; note: string; submit: string };

export function RequestAccessForm({ lang, courseId, googleEmail, labels }: { lang: string; courseId: string; googleEmail: string; labels: Labels }) {
  const [state, onSubmit, pending] = useFormAction<RequestState>(requestAccessAction.bind(null, lang, courseId), { status: "idle" });
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={labels.googleEmail} name="googleEmail" hint={labels.googleHint} error={state.fieldError}>
        <input
          id="googleEmail"
          name="googleEmail"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          defaultValue={googleEmail}
          className={inputClass}
          aria-invalid={state.fieldError ? true : undefined}
          aria-describedby={describedBy("googleEmail", state.fieldError, labels.googleHint)}
        />
      </Field>
      <Field label={labels.note} name="note">
        <textarea id="note" name="note" rows={3} maxLength={1000} dir="auto" className={inputClass} />
      </Field>
      {state.message && <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>}
      <Button type="submit" className="w-full" disabled={pending}>{labels.submit}</Button>
    </form>
  );
}
