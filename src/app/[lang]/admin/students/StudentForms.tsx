"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { manualEnrollAction, suspendStudentAction, updateStudentAction, type StudentState } from "./actions";

const idle: StudentState = { status: "idle" };
const Result = ({ state }: { state: StudentState | null }) =>
  state?.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null;

export function EditStudentForm(props: { id: string; name: string; googleEmail: string; phone: string; city: string }) {
  const [state, onSubmit, pending] = useFormAction(updateStudentAction.bind(null, props.id), idle);
  const e = (k: string) => state.errors?.[k];
  const a = (k: string) => ({ id: k, name: k, "aria-invalid": e(k) ? true : undefined, "aria-describedby": describedBy(k, e(k)) });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={e("name")}><input {...a("name")} defaultValue={props.name} maxLength={120} dir="auto" className={inputClass} /></Field>
        <Field label="Google email (for Drive sharing)" name="googleEmail" error={e("googleEmail")}><input {...a("googleEmail")} type="email" dir="ltr" defaultValue={props.googleEmail} maxLength={254} className={inputClass} /></Field>
        <Field label="Phone / WhatsApp" name="phone" error={e("phone")}><input {...a("phone")} type="tel" dir="ltr" defaultValue={props.phone} maxLength={40} className={inputClass} /></Field>
        <Field label="City" name="city" error={e("city")}><input {...a("city")} defaultValue={props.city} maxLength={80} dir="auto" className={inputClass} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" className="py-2" disabled={pending}>Save details</Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function SuspendControl({ id, suspended }: { id: string; suspended: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<StudentState | null>(null);
  const [pending, start] = useTransition();
  const run = (next: boolean) =>
    start(async () => {
      setResult(await suspendStudentAction(id, next, reason));
      setOpen(false);
      setReason("");
    });

  return (
    <div className="space-y-3">
      {suspended ? (
        <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => run(false)}>Reactivate account</Button>
      ) : open ? (
        <div role="alertdialog" aria-label="Suspend account" className="space-y-3 rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
          <p className="font-semibold text-charcoal-900">Suspend this student? They are signed out everywhere and can&apos;t log in until reactivated. Their enrollments and progress are kept.</p>
          <label htmlFor="suspend-reason" className="block font-medium">Reason (internal)</label>
          <input id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputClass} />
          <div className="flex gap-2">
            <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => run(true)}>Suspend</Button>
            <Button type="button" variant="secondary" className="py-2" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setOpen(true)}>Suspend account</button>
      )}
      <Result state={result} />
    </div>
  );
}

export function ManualEnrollForm({ id, courses }: { id: string; courses: { id: string; title: string; status: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(manualEnrollAction.bind(null, id), idle);
  if (courses.length === 0) return <p className="text-sm text-muted">Enrolled in every available course.</p>;
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="courseId" className="block text-sm font-medium text-charcoal-900">Enroll in a course</label>
        <select id="courseId" name="courseId" className={inputClass} defaultValue="">
          <option value="" disabled>Choose a course…</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.status === "ARCHIVED" ? " (archived)" : ""}</option>)}
        </select>
      </div>
      <Button type="submit" variant="dark" className="py-2.5" disabled={pending}>Enroll</Button>
      <div className="w-full"><Result state={state} /></div>
    </form>
  );
}
