"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { addResourceAction, deleteResourceAction, type CourseState } from "./actions";
import { Result } from "./CourseForms";
import { useSuccessKey } from "./Curriculum";

export type ResourceItem = { id: string; title: string; kind: "FILE" | "LINK"; href: string; detail: string; isPrivate: boolean };
export type FileOption = { id: string; name: string; isPrivate: boolean };

const idle: CourseState = { status: "idle" };

export function Resources(props: { courseId: string; lessonId: string | null; items: ResourceItem[]; files: FileOption[] }) {
  const [result, setResult] = useState<CourseState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {props.items.length === 0 ? (
        <p className="text-sm text-muted">No resources yet. Add handouts, worksheets or useful links.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {props.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="font-medium text-charcoal-900 hover:underline" dir="auto">{r.title}</a>
                <p className="truncate text-xs text-muted" dir="ltr">{r.detail}</p>
              </div>
              <StatusBadge tone="off">{r.kind === "FILE" ? (r.isPrivate ? "Private file" : "Public file") : "Link"}</StatusBadge>
              <button
                type="button"
                className="text-xs text-red-700 hover:underline disabled:opacity-50"
                disabled={pending}
                onClick={() => start(async () => setResult(await deleteResourceAction(r.id)))}
                aria-label={`Remove resource “${r.title}”`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {result && <Result state={result} />}
      <AddResource {...props} />
    </div>
  );
}

function AddResource({ courseId, lessonId, files }: { courseId: string; lessonId: string | null; files: FileOption[] }) {
  const [state, onSubmit, pending] = useFormAction(addResourceAction.bind(null, courseId, lessonId), idle);
  const key = useSuccessKey(state);
  const [kind, setKind] = useState<"FILE" | "LINK">(files.length ? "FILE" : "LINK");
  const p = lessonId ? "lr" : "cr";
  return (
    <details className="rounded-xl border border-dashed border-charcoal-200 p-4" open={state.status === "error" || undefined}>
      <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Add a resource</summary>
      <form key={key} onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">Resource type</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="FILE" checked={kind === "FILE"} onChange={() => setKind("FILE")} className="accent-charcoal-900" /> File from Media
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" value="LINK" checked={kind === "LINK"} onChange={() => setKind("LINK")} className="accent-charcoal-900" /> Web link
          </label>
        </fieldset>
        <Field label="Title" name={`${p}-title`} error={state.errors?.title}>
          <input id={`${p}-title`} name="title" maxLength={200} required dir="auto" placeholder="e.g. Brand checklist (PDF)" className={inputClass} aria-invalid={state.errors?.title ? true : undefined} />
        </Field>
        {kind === "FILE" ? (
          files.length ? (
            <Field label="File" name={`${p}-file`} error={state.errors?.mediaAssetId} hint="Private files are only downloadable by signed-in students enrolled in this course.">
              <select id={`${p}-file`} name="mediaAssetId" className={inputClass}>
                {files.map((f) => <option key={f.id} value={f.id}>{f.name}{f.isPrivate ? " (private)" : ""}</option>)}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-muted">No files yet. <Link href="/admin/media" className="font-semibold underline underline-offset-4">Upload one in Media</Link>, then come back.</p>
          )
        ) : (
          <Field label="Link" name={`${p}-url`} error={state.errors?.url}>
            <input id={`${p}-url`} name="url" type="url" dir="ltr" placeholder="https://" maxLength={1000} className={inputClass} aria-invalid={state.errors?.url ? true : undefined} />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" className="py-2" disabled={pending || (kind === "FILE" && !files.length)}>{pending ? "Adding…" : "Add resource"}</Button>
          <Result state={state} />
        </div>
      </form>
    </details>
  );
}
