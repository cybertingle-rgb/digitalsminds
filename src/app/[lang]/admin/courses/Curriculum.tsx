"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { formatMinutes } from "@/modules/courses/labels";
import {
  addLessonAction,
  addModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  moveLessonAction,
  moveLessonToModuleAction,
  moveModuleAction,
  renameModuleAction,
  type CourseState,
} from "./actions";
import { ConfirmButton, Result } from "./CourseForms";

export type CurriculumLesson = {
  id: string;
  title: string;
  hasVideo: boolean;
  hasText: boolean;
  isPreview: boolean;
  durationMinutes: number | null;
  resources: number;
  progress: number;
};
export type CurriculumModule = { id: string; title: string; lessons: CurriculumLesson[] };

const idle: CourseState = { status: "idle" };

/** A new key after each successful submit, so "add" forms clear only when the item was saved. */
export function useSuccessKey(state: CourseState) {
  const [key, setKey] = useState(0);
  const [seen, setSeen] = useState(state);
  // Adjust during render (not in an effect) when a new result arrives.
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setKey(key + 1);
  }
  return key;
}
const iconBtn = "rounded-md border border-line px-2 py-1 text-xs font-medium text-charcoal-800 hover:bg-charcoal-50 disabled:opacity-40";

export function Curriculum({ courseId, modules }: { courseId: string; modules: CurriculumModule[] }) {
  const [result, setResult] = useState<CourseState | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<CourseState>) => start(async () => {
    const r = await fn();
    // Reordering is self-evident; only report problems and real changes.
    setResult(r.status === "error" || r.message !== "Moved." ? r : null);
  });

  return (
    <div className="space-y-4">
      {result && <Result state={result} />}
      {modules.length === 0 && <p className="text-sm text-muted">No modules yet. A module groups related lessons, e.g. “Getting started”.</p>}
      <ol className="space-y-4">
        {modules.map((m, mi) => (
          <li key={m.id} className="rounded-xl border border-line" aria-label={`Module ${mi + 1}: ${m.title}`}>
            <ModuleHeader
              module={m}
              index={mi}
              last={mi === modules.length - 1}
              pending={pending}
              act={act}
              onResult={setResult}
            />
            <ol className="divide-y divide-line border-t border-line">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-6 text-xs text-muted">{li + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/courses/${courseId}/lessons/${l.id}`} className="font-medium text-charcoal-900 hover:underline" dir="auto">{l.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {l.hasVideo ? <StatusBadge tone="ok">Video</StatusBadge> : <StatusBadge tone="off">No video</StatusBadge>}
                      {l.hasText && <StatusBadge tone="off">Text</StatusBadge>}
                      {l.resources > 0 && <StatusBadge tone="off">{l.resources} {l.resources === 1 ? "resource" : "resources"}</StatusBadge>}
                      {l.isPreview && <StatusBadge tone="warn">Free preview</StatusBadge>}
                      {formatMinutes(l.durationMinutes) && <span className="self-center text-muted">{formatMinutes(l.durationMinutes)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className={iconBtn} disabled={pending || li === 0} onClick={() => act(() => moveLessonAction(l.id, "up"))} aria-label={`Move lesson “${l.title}” up`}>↑</button>
                    <button type="button" className={iconBtn} disabled={pending || li === m.lessons.length - 1} onClick={() => act(() => moveLessonAction(l.id, "down"))} aria-label={`Move lesson “${l.title}” down`}>↓</button>
                    {modules.length > 1 && (
                      <select
                        aria-label={`Move lesson “${l.title}” to another module`}
                        className="rounded-md border border-line bg-white px-2 py-1 text-xs"
                        value=""
                        disabled={pending}
                        onChange={(e) => e.target.value && act(() => moveLessonToModuleAction(l.id, e.target.value))}
                      >
                        <option value="">Move to…</option>
                        {modules.filter((o) => o.id !== m.id).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                      </select>
                    )}
                    <Link href={`/admin/courses/${courseId}/lessons/${l.id}`} className={iconBtn}>Edit</Link>
                    {l.progress === 0 ? (
                      <ConfirmButton
                        label="Delete"
                        className="px-2 text-xs text-red-700 hover:underline"
                        question={`Delete the lesson “${l.title}” and its resource links?`}
                        confirmLabel="Delete lesson"
                        run={() => deleteLessonAction(l.id)}
                        onResult={setResult}
                      />
                    ) : (
                      <span className="px-2 text-xs text-muted" title="Students have progress on this lesson">In use</span>
                    )}
                  </div>
                </li>
              ))}
              {m.lessons.length === 0 && <li className="px-4 py-3 text-sm text-red-800">This module has no lessons yet. Add one below before publishing.</li>}
            </ol>
            <div className="border-t border-line bg-surface-alt px-4 py-3">
              <AddLessonForm moduleId={m.id} />
            </div>
          </li>
        ))}
      </ol>
      <AddModuleForm courseId={courseId} />
    </div>
  );
}

function ModuleHeader(props: {
  module: CurriculumModule;
  index: number;
  last: boolean;
  pending: boolean;
  act: (fn: () => Promise<CourseState>) => void;
  onResult: (r: CourseState) => void;
}) {
  const { module: m, index, pending, act } = props;
  const [editing, setEditing] = useState(false);
  const [state, onSubmit, saving] = useFormAction(renameModuleAction.bind(null, m.id), idle);
  const inUse = m.lessons.some((l) => l.progress > 0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-center gap-2 p-4"
      >
        <label htmlFor={`m-${m.id}`} className="sr-only">Module title</label>
        <input id={`m-${m.id}`} name="title" defaultValue={m.title} maxLength={200} required autoFocus dir="auto" className={`${inputClass} mt-0 flex-1`} />
        <Button type="submit" variant="dark" className="py-2" disabled={saving}>Save</Button>
        <Button type="button" variant="secondary" className="py-2" onClick={() => setEditing(false)}>Cancel</Button>
        {state.status === "error" && <Result state={state} />}
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <h3 className="min-w-0 flex-1 font-semibold text-charcoal-900" dir="auto">
        <span className="text-muted">Module {index + 1}:</span> {m.title}
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={iconBtn} disabled={pending || index === 0} onClick={() => act(() => moveModuleAction(m.id, "up"))} aria-label={`Move module “${m.title}” up`}>↑</button>
        <button type="button" className={iconBtn} disabled={pending || props.last} onClick={() => act(() => moveModuleAction(m.id, "down"))} aria-label={`Move module “${m.title}” down`}>↓</button>
        <button type="button" className={iconBtn} onClick={() => setEditing(true)}>Rename</button>
        {!inUse && (
          <ConfirmButton
            label="Delete"
            className="px-2 text-xs text-red-700 hover:underline"
            question={m.lessons.length ? `Delete the module “${m.title}” and its ${m.lessons.length} lesson(s)?` : `Delete the module “${m.title}”?`}
            confirmLabel="Delete module"
            run={() => deleteModuleAction(m.id)}
            onResult={props.onResult}
          />
        )}
      </div>
    </div>
  );
}

function AddLessonForm({ moduleId }: { moduleId: string }) {
  const [state, onSubmit, pending] = useFormAction(addLessonAction.bind(null, moduleId), idle);
  const key = useSuccessKey(state);
  return (
    <form
      key={key}
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor={`l-${moduleId}`} className="sr-only">New lesson title</label>
      <input id={`l-${moduleId}`} name="title" placeholder="New lesson title" maxLength={200} required dir="auto" className={`${inputClass} mt-0 min-w-48 flex-1 py-2`} />
      <Button type="submit" variant="secondary" className="py-2" disabled={pending}>Add lesson</Button>
      {state.status === "error" && <Result state={state} />}
    </form>
  );
}

function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, onSubmit, pending] = useFormAction(addModuleAction.bind(null, courseId), idle);
  const key = useSuccessKey(state);
  return (
    <form
      key={key}
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-charcoal-200 p-4"
    >
      <label htmlFor="newModule" className="sr-only">New module title</label>
      <input id="newModule" name="title" placeholder="New module title, e.g. Getting started" maxLength={200} required dir="auto" className={`${inputClass} mt-0 min-w-48 flex-1 py-2`} />
      <Button type="submit" variant="dark" className="py-2" disabled={pending}>Add module</Button>
      {state.status === "error" && <Result state={state} />}
    </form>
  );
}
