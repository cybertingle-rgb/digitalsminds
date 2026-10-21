"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { confirmStepAction, setStageAction, transferAction, type RosterState } from "./roster-actions";

/** Change a student's stage, with a note (required to withdraw). */
export function StageControl({ enrollmentId, options }: { enrollmentId: string; options: { value: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<RosterState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`stage-${enrollmentId}`}>Change stage</label>
      <select id={`stage-${enrollmentId}`} value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-lg border border-charcoal-200 bg-white/80 px-2 py-1.5 text-sm">
        <option value="">Change stage…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {stage && (
        <>
          <label className="sr-only" htmlFor={`note-${enrollmentId}`}>Note</label>
          <input id={`note-${enrollmentId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={stage === "WITHDRAWN" ? "Reason (required)" : "Note to student (optional)"} className="min-w-48 flex-1 rounded-lg border border-charcoal-200 bg-white/80 px-2 py-1.5 text-sm" />
          <Button type="button" variant="dark" className="py-1.5" disabled={pending} onClick={() => start(async () => setResult(await setStageAction(enrollmentId, stage, note)))}>{pending ? "Saving…" : "Save"}</Button>
        </>
      )}
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}

export function TransferControl({ enrollmentId, batches }: { enrollmentId: string; batches: { id: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [batch, setBatch] = useState("");
  const [result, setResult] = useState<RosterState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  if (batches.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`transfer-${enrollmentId}`}>Transfer to batch</label>
      <select id={`transfer-${enrollmentId}`} value={batch} onChange={(e) => setBatch(e.target.value)} className={`${inputClass} !mt-0 !w-auto !py-1.5 text-sm`}>
        <option value="">Transfer to…</option>
        {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      {batch && <Button type="button" variant="secondary" className="py-1.5" disabled={pending} onClick={() => start(async () => setResult(await transferAction(enrollmentId, batch, "")))}>{pending ? "Moving…" : "Transfer"}</Button>}
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}

/** A "confirmed by staff" onboarding step for one student. */
export function StaffStep({ enrollmentId, itemId, title, done }: { enrollmentId: string; itemId: string; title: string; done: boolean }) {
  const [checked, setChecked] = useState(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        className="h-4 w-4 accent-charcoal-900"
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          start(async () => {
            const r = await confirmStepAction(enrollmentId, itemId, next);
            if (r.status === "error") {
              setChecked(!next);
              setError(r.message ?? "Could not save.");
            }
          });
        }}
      />
      {title}
      {error && <span role="alert" className="text-red-700">{error}</span>}
    </label>
  );
}
