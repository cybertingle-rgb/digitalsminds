"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { createAnnouncementAction, deleteAnnouncementAction, type AnnouncementState } from "./actions";

export function AnnouncementForm({ audiences, defaultCourse }: { audiences: { value: string; label: string }[]; defaultCourse?: string }) {
  const [state, onSubmit, pending] = useFormAction<AnnouncementState>(createAnnouncementAction, { status: "idle" });
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  // Clear the form after a successful post (adjusting state during render, not in an effect).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setKey(key + 1);
  }
  const e = (k: string) => state.errors?.[k];
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Send to" name="courseId">
        <select id="courseId" name="courseId" defaultValue={defaultCourse ?? audiences[0]?.value} className={inputClass}>
          {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </Field>
      <Field label="Title" name="title" error={e("title")}>
        <input id="title" name="title" maxLength={200} dir="auto" className={inputClass} aria-invalid={e("title") ? true : undefined} aria-describedby={describedBy("title", e("title"))} />
      </Field>
      <Field label="Message" name="body" error={e("body")} hint="Blank line = new paragraph · “## ” = heading · “- ” = bullet · links are clickable.">
        <textarea id="body" name="body" rows={6} maxLength={10000} dir="auto" className={inputClass} aria-invalid={e("body") ? true : undefined} aria-describedby={describedBy("body", e("body"), "hint")} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-charcoal-900">
        <input type="checkbox" name="sendEmail" className="mt-0.5 h-5 w-5 accent-charcoal-900" />
        <span>
          Also send it by email
          <span className="block text-xs text-muted">Everyone always sees it in their account. Email counts toward your mailbox&apos;s daily sending limit.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Posting…" : "Post announcement"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}

export function DeleteAnnouncement({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => setConfirm(true)}>Delete</button>;
  return (
    <span role="alertdialog" aria-label="Delete announcement" className="flex flex-wrap items-center gap-2 text-xs">
      Delete for everyone? (Emails already sent can&apos;t be recalled.)
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => { const r = await deleteAnnouncementAction(id); if (r.status === "error") setError(r.message ?? "Could not delete."); })}>Delete</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
