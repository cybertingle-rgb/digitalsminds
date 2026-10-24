"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { convertPriceAction, refreshNowAction, saveCurrencyAction, type CurrencyState } from "./actions";

type Provider = { id: string; label: string; needsKey: boolean };

export function CurrencySettingsForm(props: {
  providers: Provider[];
  currencies: { code: string; name: string }[];
  value: { provider: string; hasKey: boolean; enabled: string[]; maxAgeHours: number; refreshHours: number; manual: Record<string, number> };
}) {
  const [state, onSubmit, pending] = useFormAction(saveCurrencyAction, { status: "idle" } as CurrencyState);
  const [provider, setProvider] = useState(props.value.provider);
  const e = (k: string) => state.errors?.[k];
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="font-semibold text-charcoal-900">Rate source</legend>
        {props.providers.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="h-4 w-4 accent-charcoal-900" />
            {p.label}
          </label>
        ))}
      </fieldset>
      {provider === "exchangerate-api" && (
        <Field label="ExchangeRate-API key" name="apiKey" hint={props.value.hasKey ? "A key is saved (encrypted). Leave empty to keep it." : "From your account at exchangerate-api.com. Stored encrypted."}>
          <input id="apiKey" name="apiKey" type="password" autoComplete="off" maxLength={200} className={inputClass} />
        </Field>
      )}
      <fieldset>
        <legend className="font-semibold text-charcoal-900">Currencies offered to visitors</legend>
        <p className="mt-1 text-sm text-muted">PKR is always offered and is the currency fees are charged in. Visitors abroad see their own currency when it is ticked here and has a current rate.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {props.currencies.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" value={c.code} defaultChecked={props.value.enabled.includes(c.code)} className="h-4 w-4 accent-charcoal-900" />
              <span className="font-mono">{c.code}</span> {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Update rates every (hours)" name="refreshHours" error={e("refreshHours")}>
          <input id="refreshHours" name="refreshHours" type="number" min={1} max={48} defaultValue={props.value.refreshHours} className={inputClass} />
        </Field>
        <Field label="Stop showing a rate older than (hours)" name="maxAgeHours" error={e("maxAgeHours")} hint="After this, prices are shown in PKR only until a fresh rate arrives.">
          <input id="maxAgeHours" name="maxAgeHours" type="number" min={6} max={336} defaultValue={props.value.maxAgeHours} className={inputClass} />
        </Field>
      </div>
      {provider === "manual" && (
        <fieldset>
          <legend className="font-semibold text-charcoal-900">Manual rates: PKR for 1 unit</legend>
          <p className="mt-1 text-sm text-muted">e.g. USD 280 means 1 US dollar = Rs 280. Saving restarts their age, so update them before they expire.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {props.currencies.map((c) => (
              <label key={c.code} className="text-sm">
                <span className="font-mono">{c.code}</span>
                <input name={`manual.${c.code}`} inputMode="decimal" defaultValue={props.value.manual[c.code] ?? ""} className={inputClass} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save and update rates"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}

export function RefreshButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CurrencyState | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => setResult(await refreshNowAction()))}>{pending ? "Updating…" : "Update rates now"}</Button>
      {result?.message && <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>}
    </div>
  );
}

export function ConvertPriceButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CurrencyState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="dark" disabled={pending || disabled} onClick={() => start(async () => setResult(await convertPriceAction(id)))}>{pending ? "Converting…" : "Convert to PKR"}</Button>
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </span>
  );
}
