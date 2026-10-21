"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { archiveItemAction, createItemAction, updateItemAction, type OnboardingState } from "./actions";

type Value = { scope: string; title: string; description: string; required: boolean; studentCompletes: boolean; position: string };
const empty: Value = { scope: "all", title: "", description: "", required: true, studentCompletes: true, position: "0" };

export function ItemForm({ id, scopes, value = empty }: { id?: string; scopes: { value: string; label: string }[]; value?: Value }) {
  const [state, onSubmit, pending] = useFormAction(id ? updateItemAction.bind(null, id) : createItemAction, { status: "idle" } as OnboardingState);
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success" && !id) setKey(key + 1);
  }
  const e = (k: string) => state.errors?.[k];
  const p = (k: string) => (id ? `${k}-${id}` : k);
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="For" name={p("scope")} error={e("scope")}>
          <select id={p("scope")} name="scope" defaultValue={value.scope} className={inputClass}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Step" name={p("title")} error={e("title")}>
            <input id={p("title")} name="title" defaultValue={value.title} maxLength={200} placeholder="e.g. Join the batch WhatsApp group" className={inputClass} aria-invalid={e("title") ? true : undefined} aria-describedby={describedBy(p("title"), e("title"))} />
          </Field>
        </div>
      </div>
      <Field label="Instructions (optional)" name={p("description")} hint="Shown under the step. Links are clickable.">
        <textarea id={p("description")} name="description" rows={3} maxLength={5000} defaultValue={value.description} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="required" defaultChecked={value.required} className="h-5 w-5 accent-charcoal-900" /> Required</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="studentCompletes" defaultChecked={value.studentCompletes} className="h-5 w-5 accent-charcoal-900" /> Student ticks it (otherwise staff confirm it)</label>
        <label className="flex items-center gap-2">Order <input name="position" type="number" min={0} max={999} defaultValue={value.position} className="w-20 rounded-lg border border-charcoal-200 px-2 py-1" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save step" : "Add step"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}

export function ArchiveItem({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OnboardingState | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  if (!confirm) return <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirm(true)}>Remove…</button>;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Remove from every checklist? (Students&apos; ticks are kept.)
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setResult(await archiveItemAction(id)))}>Remove</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
      {result?.status === "error" && <span className="text-red-700">{result.message}</span>}
    </span>
  );
}
