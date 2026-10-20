"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { setStatusAction, staffReplyAction, type TicketState } from "./actions";

const labels = { OPEN: "Open", AWAITING_STUDENT: "Waiting for student", RESOLVED: "Resolved", CLOSED: "Closed" } as const;

export function ReplyForm({ id, closed }: { id: string; closed: boolean }) {
  const [state, onSubmit, pending] = useFormAction<TicketState>(staffReplyAction.bind(null, id), { status: "idle" });
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  const [internal, setInternal] = useState(closed);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setKey(key + 1);
  }
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="body" className="block text-sm font-medium text-charcoal-900">{internal ? "Internal note (team only)" : "Reply to the student"}</label>
      <textarea id="body" name="body" rows={5} required maxLength={10000} dir="auto" className={`${inputClass} ${internal ? "!bg-sun-50" : ""}`} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="dark" className="py-2" disabled={pending}>{internal ? "Add note" : "Send reply"}</Button>
        <label className="flex items-center gap-2 text-sm text-charcoal-800">
          <input type="checkbox" name="internal" checked={internal} onChange={(e) => setInternal(e.target.checked)} disabled={closed} className="h-4 w-4 accent-charcoal-900" />
          Internal note
        </label>
      </div>
      {closed && <p className="text-xs text-muted">This ticket is closed. Reopen it to reply to the student.</p>}
      {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
    </form>
  );
}

export function StatusControl({ id, status }: { id: string; status: keyof typeof labels }) {
  const [result, setResult] = useState<TicketState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label htmlFor="ticket-status" className="block text-sm font-medium text-charcoal-900">Status</label>
      <select
        id="ticket-status"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => setResult(await setStatusAction(id, next)));
        }}
        className={inputClass}
      >
        {Object.entries(labels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {result?.message && <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>}
    </div>
  );
}
