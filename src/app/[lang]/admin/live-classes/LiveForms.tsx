"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { cancelLiveAction, createLiveAction, updateLiveAction, type LiveState } from "./actions";

type Value = { batchId: string; kind: string; title: string; description: string; date: string; time: string; durationMinutes: string; meetingUrl: string };
const empty: Value = { batchId: "", kind: "CLASS", title: "", description: "", date: "", time: "", durationMinutes: "60", meetingUrl: "" };
const KINDS = { CLASS: "Live class", HOLIDAY: "Holiday (no class)", EVENT: "Event" } as const;

/** Add a session to a batch's schedule, or edit one (`id` set). */
export function LiveClassForm({ id, batches, value = empty }: { id?: string; batches: { id: string; label: string; hasLink: boolean }[]; value?: Value }) {
  const [state, onSubmit, pending] = useFormAction(id ? updateLiveAction.bind(null, id) : createLiveAction, { status: "idle" } as LiveState);
  const [kind, setKind] = useState(value.kind);
  const [batchId, setBatchId] = useState(value.batchId);
  const e = (k: string) => state.errors?.[k];
  const aria = (k: string, hint?: string) => ({ "aria-invalid": e(k) ? true : undefined, "aria-describedby": describedBy(k, e(k), hint) });
  const p = (k: string) => (id ? `${k}-${id}` : k);
  const holiday = kind === "HOLIDAY";
  const batchHasLink = batches.find((b) => b.id === batchId)?.hasLink;
  const linkHint = batchHasLink ? "Optional: leave empty to use the batch's meeting link. Only the batch's students see it." : "Zoom, Google Meet or Microsoft Teams. Only the batch's students see it.";
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch" name={p("batchId")} error={e("batchId")}>
          <select id={p("batchId")} name="batchId" value={batchId} onChange={(ev) => setBatchId(ev.target.value)} disabled={!!id} className={inputClass} {...aria(p("batchId"))}>
            {!id && <option value="">Choose a batch</option>}
            {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          {id && <input type="hidden" name="batchId" value={value.batchId} />}
        </Field>
        <Field label="Type" name={p("kind")}>
          <select id={p("kind")} name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)} className={inputClass}>
            {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Title" name={p("title")} error={e("title")}>
          <input id={p("title")} name="title" defaultValue={value.title} maxLength={200} dir="auto" placeholder={holiday ? "e.g. Eid holiday" : "e.g. Week 2: product research"} className={inputClass} {...aria(p("title"))} />
        </Field>
        <Field label="Date (Pakistan time)" name={p("date")} error={e("date")}>
          <input id={p("date")} name="date" type="date" defaultValue={value.date} className={inputClass} {...aria(p("date"))} />
        </Field>
        {!holiday && (
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <Field label="Start time" name={p("time")} error={e("time")}>
              <input id={p("time")} name="time" type="time" defaultValue={value.time} className={inputClass} {...aria(p("time"))} />
            </Field>
            <Field label="Length (minutes)" name={p("durationMinutes")} error={e("durationMinutes")}>
              <input id={p("durationMinutes")} name="durationMinutes" type="number" min={15} max={600} step={5} defaultValue={value.durationMinutes} className={inputClass} {...aria(p("durationMinutes"))} />
            </Field>
          </div>
        )}
      </div>
      {!holiday && (
        <Field label="Meeting link" name={p("meetingUrl")} error={e("meetingUrl")} hint={linkHint}>
          <input id={p("meetingUrl")} name="meetingUrl" type="url" dir="ltr" defaultValue={value.meetingUrl} placeholder="https://meet.google.com/abc-defg-hij" className={inputClass} {...aria(p("meetingUrl"), linkHint)} />
        </Field>
      )}
      <Field label="Details for students (optional)" name={p("description")}>
        <textarea id={p("description")} name="description" rows={3} maxLength={5000} defaultValue={value.description} dir="auto" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save changes" : "Add to schedule"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}

export function CancelLiveClass({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<LiveState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return confirming ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Cancel this and tell the students?</span>
      <Button type="button" variant="dark" className="py-1.5" disabled={pending} onClick={() => start(async () => setResult(await cancelLiveAction(id)))}>Yes, cancel it</Button>
      <Button type="button" variant="secondary" className="py-1.5" onClick={() => setConfirming(false)}>Keep it</Button>
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  ) : (
    <button type="button" className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirming(true)}>Cancel…</button>
  );
}
