"use client";

import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { createBatchAction, updateBatchAction, type BatchState } from "./actions";
import { emptyBatch, type BatchValue } from "./batch-value";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft (hidden)",
  OPEN: "Open for applications",
  CLOSED: "Closed to applications",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function BatchForm({
  id,
  value = emptyBatch,
  programs,
  coordinators,
}: {
  id?: string;
  value?: BatchValue;
  programs: { id: string; title: string; paid: boolean }[];
  coordinators: { id: string; name: string; role: string }[];
}) {
  const [state, onSubmit, pending] = useFormAction(id ? updateBatchAction.bind(null, id) : createBatchAction, { status: "idle" } as BatchState);
  const e = (k: string) => state.errors?.[k];
  const aria = (k: string, hint?: string) => ({ "aria-invalid": e(k) ? true : undefined, "aria-describedby": describedBy(k, e(k), hint) });
  const hints = {
    code: "Short and unique, e.g. EBAY-07. Shown to applicants.",
    scheduleText: "Shown publicly, e.g. “Mon, Wed, Fri · 8:00–10:00 pm (Pakistan time)”.",
    capacity: "Seats are counted when a payment is verified. A full batch stops taking applications.",
    applicationDeadline: "Optional. Without it, applications close on the start date.",
    meetingUrl: "Optional default Zoom / Google Meet link. Only this batch's enrolled students see it.",
    joiningInfo: "Shown only to this batch's students: how to join, what to prepare, class rules.",
  };
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Program" name="courseId" error={e("courseId")}>
          <select id="courseId" name="courseId" defaultValue={value.courseId} className={inputClass} {...aria("courseId")}>
            <option value="">Choose a program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}{p.paid ? "" : " (no fee set)"}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" name="status" error={e("status")}>
          <select id="status" name="status" defaultValue={value.status} className={inputClass} {...aria("status")}>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Batch name" name="name" error={e("name")}>
          <input id="name" name="name" defaultValue={value.name} maxLength={120} placeholder="e.g. Batch 7 · January 2027" className={inputClass} {...aria("name")} />
        </Field>
        <Field label="Code" name="code" error={e("code")} hint={hints.code}>
          <input id="code" name="code" defaultValue={value.code} maxLength={32} dir="ltr" className={`${inputClass} uppercase`} {...aria("code", hints.code)} />
        </Field>
        <Field label="Start date" name="startDate" error={e("startDate")}>
          <input id="startDate" name="startDate" type="date" defaultValue={value.startDate} className={inputClass} {...aria("startDate")} />
        </Field>
        <Field label="End date (optional)" name="endDate" error={e("endDate")}>
          <input id="endDate" name="endDate" type="date" defaultValue={value.endDate} className={inputClass} {...aria("endDate")} />
        </Field>
        <Field label="Application deadline (optional)" name="applicationDeadline" error={e("applicationDeadline")} hint={hints.applicationDeadline}>
          <input id="applicationDeadline" name="applicationDeadline" type="date" defaultValue={value.applicationDeadline} className={inputClass} {...aria("applicationDeadline", hints.applicationDeadline)} />
        </Field>
        <Field label="Seats" name="capacity" error={e("capacity")} hint={hints.capacity}>
          <input id="capacity" name="capacity" type="number" min={1} max={2000} defaultValue={value.capacity} className={inputClass} {...aria("capacity", hints.capacity)} />
        </Field>
      </div>
      <Field label="Class days and times" name="scheduleText" error={e("scheduleText")} hint={hints.scheduleText}>
        <input id="scheduleText" name="scheduleText" defaultValue={value.scheduleText} maxLength={300} className={inputClass} {...aria("scheduleText", hints.scheduleText)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meeting link (optional)" name="meetingUrl" error={e("meetingUrl")} hint={hints.meetingUrl}>
          <input id="meetingUrl" name="meetingUrl" type="url" dir="ltr" defaultValue={value.meetingUrl} placeholder="https://zoom.us/j/…" className={inputClass} {...aria("meetingUrl", hints.meetingUrl)} />
        </Field>
        <Field label="Coordinator (optional)" name="coordinatorId" error={e("coordinatorId")}>
          <select id="coordinatorId" name="coordinatorId" defaultValue={value.coordinatorId} className={inputClass} {...aria("coordinatorId")}>
            <option value="">No coordinator</option>
            {coordinators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Joining instructions for students (optional)" name="joiningInfo" error={e("joiningInfo")} hint={hints.joiningInfo}>
        <textarea id="joiningInfo" name="joiningInfo" rows={4} maxLength={5000} defaultValue={value.joiningInfo} className={inputClass} {...aria("joiningInfo", hints.joiningInfo)} />
      </Field>
      <Field label="Internal notes (staff only, optional)" name="internalNotes" error={e("internalNotes")}>
        <textarea id="internalNotes" name="internalNotes" rows={2} maxLength={5000} defaultValue={value.internalNotes} className={inputClass} {...aria("internalNotes")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save batch" : "Create batch"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}
