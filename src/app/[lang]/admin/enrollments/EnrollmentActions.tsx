"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { decideAction, type DecisionState } from "./actions";

type Status = "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED";

/** Approve / reject / revoke / reinstate, with an optional note shown to the student. */
export function EnrollmentActions({ id, status, student }: { id: string; status: Status; student: string }) {
  const [result, setResult] = useState<DecisionState | null>(null);
  const [asking, setAsking] = useState<"REJECTED" | "REVOKED" | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const run = (decision: "APPROVED" | "REJECTED" | "REVOKED") =>
    start(async () => {
      setResult(await decideAction(id, decision, decision === "APPROVED" ? "" : note));
      setAsking(null);
      setNote("");
    });

  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;

  return (
    <div className="space-y-3">
      {asking ? (
        <div role="alertdialog" aria-label={asking === "REJECTED" ? `Reject ${student}` : `Revoke access for ${student}`} className="space-y-3 rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
          <label htmlFor={`note-${id}`} className="block font-semibold text-charcoal-900">
            {asking === "REJECTED" ? "Reason (optional, emailed to the student)" : "Reason (optional, shown on the student's account page)"}
          </label>
          <textarea id={`note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} dir="auto" className={inputClass} />
          {asking === "REVOKED" && <p className="text-xs text-charcoal-800">Access ends immediately. Remember to also remove the student from the Drive sharing of this course&apos;s videos.</p>}
          <div className="flex gap-2">
            <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => run(asking)}>
              {asking === "REJECTED" ? "Reject request" : "Revoke access"}
            </Button>
            <Button type="button" variant="secondary" className="py-2" onClick={() => setAsking(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status !== "APPROVED" && (
            <Button type="button" variant="primary" className="py-2" disabled={pending} onClick={() => run("APPROVED")}>
              {status === "REQUESTED" ? "Approve" : "Approve again"}
            </Button>
          )}
          {status === "REQUESTED" && (
            <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => setAsking("REJECTED")}>Reject</Button>
          )}
          {status === "APPROVED" && (
            <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => setAsking("REVOKED")}>Revoke access</Button>
          )}
        </div>
      )}
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}
