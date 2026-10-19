"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { statusLabels } from "@/modules/inquiries/labels";
import { addNoteAction, deleteInquiryAction, saveAlertSettingAction, updateInquiryAction, type LeadState } from "./actions";

type Staff = { id: string; name: string };

export function LeadUpdateForm(props: { id: string; status: string; assignedToId: string | null; followUpDay: string | null; staff: Staff[] }) {
  const [state, onSubmit, pending] = useFormAction<LeadState>(updateInquiryAction.bind(null, props.id), { status: "idle" });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Status" name="status">
        <select id="status" name="status" defaultValue={props.status} className={inputClass}>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Assigned to" name="assignedToId">
        <select id="assignedToId" name="assignedToId" defaultValue={props.assignedToId ?? ""} className={inputClass}>
          <option value="">Unassigned</option>
          {props.staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Follow up on" name="followUpDay" hint="Pakistan date. Leave empty for no reminder.">
        <input id="followUpDay" name="followUpDay" type="date" defaultValue={props.followUpDay ?? ""} className={inputClass} />
      </Field>
      {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [state, onSubmit, pending] = useFormAction<LeadState>(addNoteAction.bind(null, id), { status: "idle" });
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      onSubmit={(e) => {
        onSubmit(e);
        // Clear the box once the note is saved.
        setTimeout(() => setKey((k) => k + 1), 600);
      }}
      className="space-y-3"
    >
      <label htmlFor="body" className="block text-sm font-medium text-charcoal-900">Add a note</label>
      <textarea id="body" name="body" rows={3} required maxLength={5000} className={inputClass} placeholder="Called, sent proposal, next steps…" />
      {state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Button type="submit" variant="dark" className="py-2" disabled={pending}>{pending ? "Adding…" : "Add note"}</Button>
    </form>
  );
}

export function DeleteLead({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirm(true)}>
        Delete this inquiry
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirm delete" className="rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
      <p className="font-semibold text-charcoal-900">Delete this inquiry and its notes permanently? Use this for privacy requests or junk.</p>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="dark"
          className="py-2"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteInquiryAction(id);
              if (r.status === "success") router.push("/admin/inquiries");
              else setError(r.message ?? "Could not delete.");
            })
          }
        >
          Delete permanently
        </Button>
        <Button type="button" variant="secondary" className="py-2" onClick={() => setConfirm(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function AlertSettingForm({ enabled, email, smtpReady }: { enabled: boolean; email: string; smtpReady: boolean }) {
  const [state, onSubmit, pending] = useFormAction<LeadState>(saveAlertSettingAction, { status: "idle" });
  return (
    <details className="rounded-2xl border border-line bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">
        Lead alert emails: {enabled ? `on, to ${email}` : "off"}
      </summary>
      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5 accent-charcoal-900" />
          Email me when a new inquiry arrives
        </label>
        <div className="min-w-64">
          <label htmlFor="alertEmail" className="block text-sm font-medium text-charcoal-900">Send to</label>
          <input id="alertEmail" name="email" type="email" dir="ltr" defaultValue={email} required className={inputClass} />
        </div>
        <Button type="submit" variant="dark" className="py-2" disabled={pending}>Save</Button>
      </form>
      {!smtpReady && <p className="mt-3 text-xs text-gold-700">Email sending isn&apos;t set up yet, so alerts can&apos;t be delivered. Set it up in Integrations.</p>}
      {state.message && <div className="mt-3"><Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice></div>}
    </details>
  );
}
