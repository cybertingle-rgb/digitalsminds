"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { deleteStudentAction, suspendLegacyAction, suspendStudentAction, updateStudentAction, type StudentState } from "./actions";

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
        <input type="hidden" name="googleEmail" value={props.googleEmail} />
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

export function DeleteStudent({ id, email, inquiries }: { id: string; email: string; inquiries: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<StudentState | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setOpen(true)}>Delete account permanently</button>;
  }
  return (
    <div role="alertdialog" aria-label="Delete account permanently" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
      <p className="font-semibold text-red-900">This permanently deletes the account, enrollments, progress, certificates, support requests, notifications, payment records and receipts, and newsletter subscription. Keep any payment records you need for your accounts before deleting. It can&apos;t be undone.</p>
      {inquiries > 0 && <p className="text-red-900">{inquiries} inquiry/inquiries from this email stay in Inquiries; delete them there if the request covers them too.</p>}
      <label htmlFor="confirm-email" className="block font-medium text-charcoal-900">Type <span dir="ltr" className="font-mono">{email}</span> to confirm</label>
      <input id="confirm-email" value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr" autoComplete="off" className={inputClass} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="dark"
          className="py-2"
          disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}
          onClick={() =>
            start(async () => {
              const r = await deleteStudentAction(id, typed);
              setResult(r);
              if (r.status === "success") router.push("/admin/students");
            })
          }
        >
          Delete permanently
        </Button>
        <Button type="button" variant="secondary" className="py-2" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <Result state={result} />
    </div>
  );
}

/** One-off clean-up: suspend accounts made through the old free sign-up (shows the count first). */
export function SuspendLegacy({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<StudentState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return (
    <div className="space-y-2">
      {!confirm ? (
        <Button type="button" variant="dark" disabled={count === 0} onClick={() => setConfirm(true)}>Suspend {count} {count === 1 ? "account" : "accounts"}…</Button>
      ) : (
        <div role="alertdialog" aria-label="Suspend old accounts" className="space-y-3 rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
          <p className="font-semibold text-charcoal-900">Suspend these {count} accounts? They are signed out and can&apos;t log in. Nothing is deleted, and you can reactivate anyone from their student page.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dark" disabled={pending} onClick={() => start(async () => setResult(await suspendLegacyAction(count)))}>{pending ? "Suspending…" : `Yes, suspend ${count}`}</Button>
            <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}
