"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { confirmPaymentAction, rejectPaymentAction, savePaymentDetailsAction, type PaymentState } from "./actions";

/** Confirm (opens the course) or reject (with a reason for the student). */
export function PaymentDecision({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PaymentState | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return (
    <div className="space-y-3">
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="dark" disabled={pending} onClick={() => start(async () => setResult(await confirmPaymentAction(id)))}>
            {pending ? "Saving…" : "Confirm payment & open course"}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setRejecting(true)}>Reject…</Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/80 p-4">
          <Field label="Reason (sent to the student)" name="rejectNote" hint="e.g. We couldn't find this transaction. Please check the ID and send it again.">
            <textarea id="rejectNote" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} dir="auto" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dark" disabled={pending || note.trim().length < 3} onClick={() => start(async () => setResult(await rejectPaymentAction(id, note)))}>
              {pending ? "Saving…" : "Reject payment"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}

type Details = Partial<Record<"bankName" | "bankAccountTitle" | "bankAccountNumber" | "jazzcashTitle" | "jazzcashNumber" | "easypaisaTitle" | "easypaisaNumber" | "instructions" | "instructionsUr", string>>;

export function PaymentDetailsForm({ value }: { value: Details }) {
  const [state, onSubmit, pending] = useFormAction(savePaymentDetailsAction, { status: "idle" } as PaymentState);
  const input = (name: keyof Details, label: string, hint?: string) => (
    <Field label={label} name={name} hint={hint}>
      <input id={name} name={name} defaultValue={value[name] ?? ""} dir="auto" autoComplete="off" className={inputClass} />
    </Field>
  );
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset className="glass space-y-4 rounded-2xl p-5">
        <legend className="sr-only">Bank transfer</legend>
        <p className="font-semibold text-charcoal-900">Bank transfer</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {input("bankName", "Bank")}
          {input("bankAccountTitle", "Account title")}
          {input("bankAccountNumber", "Account number / IBAN", "Leave empty to turn bank transfer off.")}
        </div>
      </fieldset>
      <fieldset className="glass space-y-4 rounded-2xl p-5">
        <legend className="sr-only">JazzCash</legend>
        <p className="font-semibold text-charcoal-900">JazzCash</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("jazzcashTitle", "Account title")}
          {input("jazzcashNumber", "JazzCash account number", "Leave empty to turn JazzCash off.")}
        </div>
      </fieldset>
      <fieldset className="glass space-y-4 rounded-2xl p-5">
        <legend className="sr-only">EasyPaisa</legend>
        <p className="font-semibold text-charcoal-900">EasyPaisa</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("easypaisaTitle", "Account title")}
          {input("easypaisaNumber", "EasyPaisa account number", "Leave empty to turn EasyPaisa off.")}
        </div>
      </fieldset>
      <fieldset className="glass space-y-4 rounded-2xl p-5">
        <legend className="sr-only">Extra instructions</legend>
        <p className="font-semibold text-charcoal-900">Extra instructions (optional)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instructions" name="instructions">
            <textarea id="instructions" name="instructions" rows={3} maxLength={1500} defaultValue={value.instructions ?? ""} className={inputClass} placeholder="e.g. Write your email in the transfer description." />
          </Field>
<input type="hidden" name="instructionsUr" value={value.instructionsUr ?? ""} />
        </div>
      </fieldset>
      <p className="text-xs text-muted">These details are shown only to applicants on their private application page (after they confirm their email), never elsewhere on the website.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save payment details"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}
