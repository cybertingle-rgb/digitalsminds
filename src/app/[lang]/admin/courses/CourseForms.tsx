"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { formatLabels, languageLabels, levelLabels } from "@/modules/courses/labels";
import {
  createCourseAction,
  deleteCourseAction,
  saveDetailsAction,
  setInstructorsAction,
  setPriceAction,
  setStatusAction,
  type CourseState,
} from "./actions";

const idle: CourseState = { status: "idle" };

/** Navigates when an action asks for it (e.g. after creating a course). */
function useFollow(state: CourseState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
}

export function Result({ state }: { state: CourseState | null }) {
  if (!state?.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

/** Button that asks for confirmation inline before running a destructive action. */
export function ConfirmButton(props: {
  label: string;
  question: ReactNode;
  confirmLabel: string;
  run: () => Promise<CourseState>;
  onResult?: (r: CourseState) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" className={props.className ?? "text-sm text-red-700 underline-offset-4 hover:underline"} onClick={() => setOpen(true)}>
        {props.label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={props.label} className="mt-2 w-full rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
      <p className="font-semibold text-charcoal-900">{props.question}</p>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="dark"
          className="py-2"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await props.run();
              if (r.status === "error") setError(r.message ?? "Something went wrong.");
              else {
                setOpen(false);
                props.onResult?.(r);
              }
            })
          }
        >
          {props.confirmLabel}
        </Button>
        <Button type="button" variant="secondary" className="py-2" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
      </div>
    </div>
  );
}

const err = (state: CourseState, name: string) => state.errors?.[name];
const invalid = (state: CourseState, name: string) => (state.errors?.[name] ? true : undefined);

// --- New course --------------------------------------------------------------

export function NewCourseForm() {
  const [state, onSubmit, pending] = useFormAction(createCourseAction, idle);
  useFollow(state);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Program title" name="title" error={err(state, "title")}>
        <input id="title" name="title" required maxLength={200} dir="auto" className={inputClass} aria-invalid={invalid(state, "title")} aria-describedby={describedBy("title", err(state, "title"))} />
      </Field>
      <Field label="Taught in" name="language" hint="The language the classes are taught in.">
        <select id="language" name="language" defaultValue="en" className={inputClass} aria-describedby={describedBy("language", undefined, "hint")}>
          {Object.entries(languageLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Short summary" name="summary" error={err(state, "summary")} hint="One or two sentences shown in the program list.">
        <textarea id="summary" name="summary" rows={3} required maxLength={500} dir="auto" className={inputClass} aria-invalid={invalid(state, "summary")} aria-describedby={describedBy("summary", err(state, "summary"), "hint")} />
      </Field>
      {state.status === "error" && <Result state={state} />}
      <Button type="submit" variant="dark" disabled={pending}>{pending ? "Creating…" : "Create program"}</Button>
    </form>
  );
}

// --- Details -----------------------------------------------------------------

export type CourseDetails = {
  id: string;
  title: string;
  titleUr: string;
  slug: string;
  slugLocked: boolean;
  language: "en" | "ur";
  summary: string;
  summaryUr: string;
  description: string;
  objectives: string;
  prerequisites: string;
  level: keyof typeof levelLabels;
  durationText: string;
  format: keyof typeof formatLabels;
  thumbnailId: string;
  serviceSlug: string;
  certificateEnabled: boolean;
  seoTitle: string;
  seoDescription: string;
};

export type ImageOption = { id: string; name: string; url: string };

const formattingHint = "Blank line = new paragraph · start a line with “## ” for a heading · “- ” for a bullet · links are clickable.";

export function DetailsForm({ course, images, services }: { course: CourseDetails; images: ImageOption[]; services: { slug: string; title: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(saveDetailsAction.bind(null, course.id), idle);
  const [thumb, setThumb] = useState(course.thumbnailId);
  const thumbUrl = images.find((i) => i.id === thumb)?.url;
  const f = (name: keyof CourseDetails, label: string, el: ReactNode, hint?: string) => (
    <Field label={label} name={name} error={err(state, name)} hint={hint}>{el}</Field>
  );
  const a = (name: string, hint?: boolean) => ({
    id: name,
    name,
    "aria-invalid": invalid(state, name),
    "aria-describedby": describedBy(name, err(state, name), hint ? "hint" : undefined),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold uppercase tracking-wider text-muted">Catalogue listing</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {f("title", "Title", <input {...a("title")} defaultValue={course.title} maxLength={200} dir="auto" className={inputClass} />)}
          <input type="hidden" name="titleUr" value={course.titleUr} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {f("summary", "Summary", <textarea {...a("summary")} defaultValue={course.summary} rows={3} maxLength={500} dir="auto" className={inputClass} />)}
          <input type="hidden" name="summaryUr" value={course.summaryUr} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {f(
            "slug",
            "Web address",
            <div className="mt-1 flex items-center rounded-lg border border-charcoal-200 bg-charcoal-50 text-sm" dir="ltr">
              <span className="px-3 text-muted">/courses/</span>
              <input {...a("slug", true)} defaultValue={course.slug} readOnly={course.slugLocked} maxLength={80} className="min-w-0 flex-1 rounded-r-lg border-0 bg-white px-3 py-2.5 read-only:bg-charcoal-50 read-only:text-muted focus:outline-none focus:ring-2 focus:ring-sun-400" />
            </div>,
            course.slugLocked ? "Locked after publishing, so shared links keep working." : "Lowercase letters, numbers and dashes.",
          )}
          <div>
            <Field label="Thumbnail" name="thumbnailId" error={err(state, "thumbnailId")} hint={images.length ? "A public image from the Media library (16:9 works best)." : "Upload a public image in Media first."}>
              <select {...a("thumbnailId", true)} value={thumb} onChange={(e) => setThumb(e.target.value)} className={inputClass}>
                <option value="">No thumbnail</option>
                {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            {thumbUrl && (
              <div className="relative mt-2 aspect-video w-48 overflow-hidden rounded-lg bg-charcoal-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt="Thumbnail preview" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold uppercase tracking-wider text-muted">Program page</legend>
        <div className="grid gap-5 sm:grid-cols-3">
          {f("language", "Taught in", <select {...a("language")} defaultValue={course.language} className={inputClass}>{Object.entries(languageLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {f("level", "Level", <select {...a("level")} defaultValue={course.level} className={inputClass}>{Object.entries(levelLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {f("format", "Format", <select {...a("format")} defaultValue={course.format} className={inputClass}>{Object.entries(formatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
        </div>
        {f("durationText", "Duration (optional)", <input {...a("durationText", true)} defaultValue={course.durationText} maxLength={160} className={inputClass} />, "e.g. “8 weeks · 3 live classes a week”. Batch dates and class times are set per batch.")}
        {f("description", "Description", <textarea {...a("description", true)} defaultValue={course.description} rows={8} maxLength={20000} dir="auto" className={inputClass} />, formattingHint)}
        <div className="grid gap-5 sm:grid-cols-2">
          {f("objectives", "Learning objectives", <textarea {...a("objectives", true)} defaultValue={course.objectives} rows={6} dir="auto" className={inputClass} />, "One per line.")}
          {f("prerequisites", "Eligibility and requirements (optional)", <textarea {...a("prerequisites", true)} defaultValue={course.prerequisites} rows={6} dir="auto" className={inputClass} />, "Who can join and what they need, e.g. a laptop and internet connection.")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {f(
            "serviceSlug",
            "Related service (optional)",
            <select {...a("serviceSlug")} defaultValue={course.serviceSlug} className={inputClass}>
              <option value="">None</option>
              {services.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
            </select>,
          )}
          <label className="flex items-center gap-3 self-end pb-2 text-sm text-charcoal-900">
            <input type="checkbox" name="certificateEnabled" defaultChecked={course.certificateEnabled} className="h-5 w-5 accent-charcoal-900" />
            Students can receive a certificate when staff mark them completed
          </label>
        </div>
      </fieldset>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Search engine settings (optional)</summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {f("seoTitle", "Search title", <input {...a("seoTitle", true)} defaultValue={course.seoTitle} maxLength={200} dir="auto" className={inputClass} />, "Defaults to the program title.")}
          {f("seoDescription", "Search description", <textarea {...a("seoDescription", true)} defaultValue={course.seoDescription} rows={3} maxLength={320} dir="auto" className={inputClass} />, "Defaults to the summary.")}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
        <Result state={state} />
      </div>
    </form>
  );
}

// --- Instructors -------------------------------------------------------------

export function InstructorsForm(props: { courseId: string; assigned: string[]; options: { id: string; name: string; email: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(setInstructorsAction.bind(null, props.courseId), idle);
  if (props.options.length === 0) {
    return <p className="text-sm text-muted">No instructors on the team yet. Invite one in Team with the Instructor role, then assign them here.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ul className="space-y-2">
        {props.options.map((o) => (
          <li key={o.id}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="instructorIds" value={o.id} defaultChecked={props.assigned.includes(o.id)} className="mt-0.5 h-5 w-5 accent-charcoal-900" />
              <span>
                <span className="font-medium text-charcoal-900">{o.name}</span>
                <span className="block text-muted" dir="ltr">{o.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" variant="secondary" className="py-2" disabled={pending}>{pending ? "Saving…" : "Save instructors"}</Button>
      <Result state={state} />
    </form>
  );
}

// --- Price (Super Admin) -----------------------------------------------------------

export function PriceForm(props: { courseId: string; paid: boolean; pricePkr: number | null }) {
  const [state, onSubmit, pending] = useFormAction(setPriceAction.bind(null, props.courseId), idle);
  const err = state.errors?.pricePkr;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Every program charges its full fee before enrollment is confirmed. */}
      <input type="hidden" name="access" value="PAID" />
      <Field label="Enrollment fee in rupees (PKR)" name="pricePkr" error={err} hint="Whole rupees, e.g. 15000. Paid in full before enrollment is confirmed. New applications use the new fee; earlier ones keep theirs.">
        <input id="pricePkr" name="pricePkr" inputMode="numeric" dir="ltr" defaultValue={props.pricePkr ?? ""} className={inputClass} aria-invalid={err ? true : undefined} aria-describedby={describedBy("pricePkr", err, "hint")} />
      </Field>
      <Button type="submit" variant="secondary" className="py-2" disabled={pending}>{pending ? "Saving…" : "Save fee"}</Button>
      <Result state={state} />
    </form>
  );
}

// --- Publishing --------------------------------------------------------------

export function PublishPanel(props: {
  courseId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  canPublish: boolean;
  checklist: { ok: boolean; label: string }[];
  warnings: string[];
  deletable: boolean;
  enrollments: number;
}) {
  const router = useRouter();
  const [result, setResult] = useState<CourseState | null>(null);
  const [pending, start] = useTransition();
  const ready = props.checklist.every((c) => c.ok);
  const set = (s: "DRAFT" | "PUBLISHED" | "ARCHIVED") => start(async () => setResult(await setStatusAction(props.courseId, s)));

  return (
    <div className="space-y-4 text-sm">
      {props.status !== "ARCHIVED" && (
        <>
          <ul className="space-y-1.5" aria-label="Publishing checklist">
            {props.checklist.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span aria-hidden className={c.ok ? "text-green-700" : "text-red-700"}>{c.ok ? "✓" : "✗"}</span>
                <span className={c.ok ? "text-charcoal-800" : "font-medium text-red-800"}>
                  <span className="sr-only">{c.ok ? "Done: " : "To do: "}</span>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          {props.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-sun-50 p-3 text-xs text-charcoal-800" aria-label="Recommendations">
              {props.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          )}
        </>
      )}

      {props.canPublish ? (
        <div className="flex flex-wrap gap-2">
          {props.status !== "PUBLISHED" && (
            <Button type="button" variant="primary" className="py-2" disabled={pending || !ready} onClick={() => set("PUBLISHED")}>
              {props.status === "ARCHIVED" ? "Restore & publish" : "Publish"}
            </Button>
          )}
          {props.status === "PUBLISHED" && (
            <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => set("DRAFT")}>Unpublish</Button>
          )}
          {props.status === "ARCHIVED" && (
            <Button type="button" variant="secondary" className="py-2" disabled={pending} onClick={() => set("DRAFT")}>Restore as draft</Button>
          )}
        </div>
      ) : (
        props.status === "DRAFT" && <p className="text-muted">{ready ? "Ready for review. Ask a Content Manager or Super Admin to publish it." : "Complete the checklist, then ask a Content Manager or Super Admin to publish it."}</p>
      )}
      <Result state={result} />

      {props.canPublish && props.status !== "ARCHIVED" && (
        <ConfirmButton
          label="Archive program"
          className="text-sm text-charcoal-700 underline underline-offset-4"
          question={`Archive this program? It disappears from the website and takes no new applications.${props.enrollments ? " Enrolled students keep their records." : ""}`}
          confirmLabel="Archive"
          run={() => setStatusAction(props.courseId, "ARCHIVED")}
          onResult={setResult}
        />
      )}
      {props.deletable && (
        <ConfirmButton
          label="Delete program"
          question="Delete this draft program? Files stay in the Media library."
          confirmLabel="Delete permanently"
          run={() => deleteCourseAction(props.courseId)}
          onResult={(r) => r.redirectTo && router.push(r.redirectTo)}
        />
      )}
    </div>
  );
}
