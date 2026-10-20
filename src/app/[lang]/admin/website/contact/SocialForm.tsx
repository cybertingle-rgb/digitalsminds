"use client";

import { Notice } from "@/components/admin/ui";
import { SocialIcon } from "@/components/effects/SocialIcon";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { socialLabels, type SocialPlatform } from "@/modules/settings/social-types";
import { saveSocialAction, type WebsiteState } from "../actions";

const examples: Record<SocialPlatform, string> = {
  facebook: "https://www.facebook.com/yourpage",
  instagram: "https://www.instagram.com/yourname",
  linkedin: "https://www.linkedin.com/company/yourcompany",
};

export function SocialForm({ values }: { values: Record<SocialPlatform, string> }) {
  const [state, onSubmit, pending] = useFormAction<WebsiteState>(saveSocialAction, { status: "idle" });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {(Object.keys(examples) as SocialPlatform[]).map((p) => {
        const err = state.errors?.[p];
        return (
          <Field key={p} label={socialLabels[p]} name={p} error={err}>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-white"><SocialIcon platform={p} /></span>
              <input id={p} name={p} type="url" dir="ltr" defaultValue={values[p]} placeholder={examples[p]} maxLength={300} className={`${inputClass} mt-0`} aria-invalid={err ? true : undefined} aria-describedby={describedBy(p, err)} />
            </div>
          </Field>
        );
      })}
      <p className="text-xs text-muted">Leave a box empty to hide that icon. Links must start with https://.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save social links"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}
