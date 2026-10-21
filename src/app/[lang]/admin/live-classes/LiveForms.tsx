"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { cancelLiveAction, createLiveAction, updateLiveAction, type LiveState } from "./actions";

type Value = { courseId: string; title: string; description: string; date: string; time: string; durationMinutes: string; meetingUrl: string };
const empty: Value = { courseId: "", title: "", description: "", date: "", time: "", durationMinutes: "60", meetingUrl: "" };

/** Schedule a new class, or edit one (`id` set). */
export function LiveClassForm({ id, courses, value = empty }: { id?: string; courses: { id: string; title: string }[]; value?: Value }) {
  const [state, onSubmit, pending] = useFormAction(id ? updateLiveAction.bind(null, id) : createLiveAction, { status: "idle" } as LiveState);
  const e = (k: string) => state.errors?.[k];
  const aria = (k: string, hint?: string) => ({ "aria-invalid": e(k) ? true : undefined, "aria-describedby": describedBy(k, e(k), hint) });
  const p = (k: string) => (id ? `${k}-${id}` : k);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" name={p("courseId")} error={e("courseId")}>
          <select id={p("courseId")} name="courseId" defaultValue={value.courseId} disabled={!!id} className={inputClass} {...aria(p("courseId"))}>
            {!id && <option value="">Choose a course</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {id && <input type="hidden" name="courseId" value={value.courseId} />}
        </Field>
        <Field label="Title" name={p("title")} error={e("title")}>
          <input id={p("title")} name="title" defaultValue={value.title} maxLength={200} dir="auto" placeholder="e.g. Live Q&A: your first listing" className={inputClass} {...aria(p("title"))} />
        </Field>
        <Field label="Date (Pakistan time)" name={p("date")} error={e("date")}>
          <input id={p("date")} name="date" type="date" defaultValue={value.date} className={inputClass} {...aria(p("date"))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time" name={p("time")} error={e("time")}>
            <input id={p("time")} name="time" type="time" defaultValue={value.time} className={inputClass} {...aria(p("time"))} />
          </Field>
          <Field label="Length (minutes)" name={p("durationMinutes")} error={e("durationMinutes")}>
            <input id={p("durationMinutes")} name="durationMinutes" type="number" min={15} max={600} step={5} defaultValue={value.durationMinutes} className={inputClass} {...aria(p("durationMinutes"))} />
          </Field>
        </div>
      </div>
      <Field label="Meeting link" name={p("meetingUrl")} error={e("meetingUrl")} hint="Zoom, Google Meet or Microsoft Teams. Only the course's enrolled students see it.">
        <input id={p("meetingUrl")} name="meetingUrl" type="url" dir="ltr" defaultValue={value.meetingUrl} placeholder="https://meet.google.com/abc-defg-hij" className={inputClass} {...aria(p("meetingUrl"), "Zoom, Google Meet or Microsoft Teams. Only the course's enrolled students see it.")} />
      </Field>
      <Field label="What it's about (optional)" name={p("description")}>
        <textarea id={p("description")} name="description" rows={3} maxLength={5000} defaultValue={value.description} dir="auto" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save changes" : "Schedule class"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}

export function CancelLiveClass({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<LiveState | null>(null);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return confirming ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Cancel this class and tell the students?</span>
      <Button type="button" variant="dark" className="py-1.5" disabled={pending} onClick={() => start(async () => setResult(await cancelLiveAction(id)))}>Yes, cancel it</Button>
      <Button type="button" variant="secondary" className="py-1.5" onClick={() => setConfirming(false)}>Keep it</Button>
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  ) : (
    <button type="button" className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirming(true)}>Cancel class…</button>
  );
}
