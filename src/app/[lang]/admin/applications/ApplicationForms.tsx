"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { closeApplicationAction, moveApplicationAction, rejectPaymentAction, resendLinkAction, verifyPaymentAction, type AppState } from "./actions";

function Result({ state }: { state: AppState | null }) {
  if (!state?.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

/** Verify (reserves the seat and creates the account) or reject (with a reason for the applicant). */
export function PaymentDecision({ paymentId, feePkr }: { paymentId: string; feePkr: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AppState | null>(null);
  const [mode, setMode] = useState<"idle" | "verify" | "reject">("idle");
  const [amount, setAmount] = useState(String(feePkr));
  const [note, setNote] = useState("");
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return (
    <div className="space-y-3">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="dark" onClick={() => setMode("verify")}>Verify payment…</Button>
          <Button type="button" variant="secondary" onClick={() => setMode("reject")}>Reject…</Button>
        </div>
      )}
      {mode === "verify" && (
        <div role="group" aria-label="Verify payment" className="space-y-3 rounded-xl border border-green-200 bg-green-50/80 p-4">
          <p className="text-sm text-charcoal-900">
            Only verify after you&apos;ve seen the money arrive in the account statement. A screenshot alone is not proof. Verifying reserves a seat, confirms the enrollment
            and creates the student account.
          </p>
          <Field label="Amount received (rupees)" name="amountReceived" hint={`The fee is Rs ${feePkr.toLocaleString("en-US")}, paid in full.`}>
            <input id="amountReceived" inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} aria-describedby="amountReceived-hint" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dark" disabled={pending} onClick={() => start(async () => setResult(await verifyPaymentAction(paymentId, amount)))}>
              {pending ? "Verifying…" : "Yes, the money arrived: verify"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}
      {mode === "reject" && (
        <div role="group" aria-label="Reject payment" className="space-y-3 rounded-xl border border-red-200 bg-red-50/80 p-4">
          <Field label="Reason (sent to the applicant)" name="rejectNote" hint="e.g. We couldn't find this transaction. Please check the ID and send it again.">
            <textarea id="rejectNote" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} dir="auto" aria-describedby="rejectNote-hint" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dark" disabled={pending || note.trim().length < 3} onClick={() => start(async () => setResult(await rejectPaymentAction(paymentId, note)))}>
              {pending ? "Saving…" : "Reject payment"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode("idle")}>Cancel</Button>
          </div>
        </div>
      )}
      <Result state={result} />
    </div>
  );
}

export function MoveApplication({ applicationId, current, batches }: { applicationId: string; current: string; batches: { id: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AppState | null>(null);
  const [batch, setBatch] = useState(current);
  return (
    <div className="space-y-2">
      <Field label="Move to batch" name="moveBatch">
        <select id="moveBatch" value={batch} onChange={(e) => setBatch(e.target.value)} className={inputClass}>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </Field>
      <Button type="button" variant="secondary" className="py-2" disabled={pending || batch === current} onClick={() => start(async () => setResult(await moveApplicationAction(applicationId, batch)))}>
        {pending ? "Moving…" : "Move"}
      </Button>
      <Result state={result} />
    </div>
  );
}

export function CloseApplication({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AppState | null>(null);
  const [outcome, setOutcome] = useState<"" | "REJECTED" | "CANCELLED">("");
  const [note, setNote] = useState("");
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  if (!outcome) {
    return (
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" className="font-semibold text-red-700 underline-offset-4 hover:underline" onClick={() => setOutcome("REJECTED")}>Reject application…</button>
        <button type="button" className="font-semibold text-charcoal-700 underline-offset-4 hover:underline" onClick={() => setOutcome("CANCELLED")}>Cancel application…</button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/80 p-4">
      <Field label="Note to the applicant (optional)" name="closeNote">
        <textarea id="closeNote" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} dir="auto" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="dark" disabled={pending} onClick={() => start(async () => setResult(await closeApplicationAction(applicationId, outcome, note)))}>
          {pending ? "Saving…" : outcome === "REJECTED" ? "Reject application" : "Cancel application"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOutcome("")}>Back</Button>
      </div>
      <Result state={result} />
    </div>
  );
}

export function ResendLink({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AppState | null>(null);
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4" onClick={() => start(async () => setResult(await resendLinkAction(applicationId)))}>
        {pending ? "Sending…" : "Email the applicant a new link"}
      </button>
      <Result state={result} />
    </div>
  );
}
