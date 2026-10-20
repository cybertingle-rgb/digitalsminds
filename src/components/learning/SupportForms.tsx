"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { describedBy, Field, FormAlert, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { createTicketAction, studentReplyAction, type SupportState } from "@/app/[lang]/(marketing)/account/support/actions";

const idle: SupportState = { status: "idle" };

type NewLabels = { subject: string; course: string; noCourse: string; message: string; send: string };

export function NewTicketForm({ lang, courses, labels }: { lang: string; courses: { id: string; title: string }[]; labels: NewLabels }) {
  const [state, onSubmit, pending] = useFormAction(createTicketAction.bind(null, lang), idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  const e = (k: string) => state.errors?.[k];
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={labels.subject} name="subject" error={e("subject")}>
        <input id="subject" name="subject" maxLength={200} dir="auto" className={inputClass} aria-invalid={e("subject") ? true : undefined} aria-describedby={describedBy("subject", e("subject"))} />
      </Field>
      {courses.length > 0 && (
        <Field label={labels.course} name="courseId">
          <select id="courseId" name="courseId" defaultValue="" className={inputClass}>
            <option value="">{labels.noCourse}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
      )}
      <Field label={labels.message} name="message" error={e("message")}>
        <textarea id="message" name="message" rows={5} maxLength={10000} dir="auto" className={inputClass} aria-invalid={e("message") ? true : undefined} aria-describedby={describedBy("message", e("message"))} />
      </Field>
      {state.message && <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>}
      <Button type="submit" variant="dark" disabled={pending}>{labels.send}</Button>
    </form>
  );
}

export function StudentReplyForm({ lang, ticketId, labels }: { lang: string; ticketId: string; labels: { reply: string; send: string } }) {
  const [state, onSubmit, pending] = useFormAction(studentReplyAction.bind(null, lang, ticketId), idle);
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setKey(key + 1);
  }
  const err = state.errors?.body;
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-3" noValidate>
      <Field label={labels.reply} name="body" error={err}>
        <textarea id="body" name="body" rows={4} maxLength={10000} dir="auto" className={inputClass} aria-invalid={err ? true : undefined} aria-describedby={describedBy("body", err)} />
      </Field>
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <Button type="submit" variant="dark" disabled={pending}>{labels.send}</Button>
    </form>
  );
}
