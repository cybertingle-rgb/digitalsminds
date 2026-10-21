"use client";

import { useState, useTransition } from "react";
import { setOnboardingAction } from "@/app/[lang]/(marketing)/account/actions";

/** A checklist step the student can tick; saved straight away. */
export function OnboardingCheck(props: { lang: string; enrollmentId: string; itemId: string; done: boolean; label: string; errorText: string }) {
  const [done, setDone] = useState(props.done);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-charcoal-900">
        <input
          type="checkbox"
          checked={done}
          disabled={pending}
          className="h-5 w-5 accent-charcoal-900"
          onChange={(e) => {
            const next = e.target.checked;
            setDone(next);
            setError(false);
            start(async () => {
              const r = await setOnboardingAction(props.lang, props.enrollmentId, props.itemId, next);
              if (r.status === "error") {
                setDone(!next);
                setError(true);
              }
            });
          }}
        />
        {props.label}
      </label>
      {error && <span role="alert" className="text-xs text-red-700">{props.errorText}</span>}
    </span>
  );
}
