"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import type { WebsiteState } from "./actions";
import { deleteItemAction, importFaqsAction, moveItemAction, saveCaseStudyAction, saveFaqAction, saveTestimonialAction } from "./item-actions";
import { ImagePicker, type ImageOption } from "./WebsiteForms";

const idle: WebsiteState = { status: "idle" };
type Kind = "faq" | "testimonial" | "caseStudy";

const formatting = "Blank line = new paragraph · “## ” = heading · “- ” = bullet · links are clickable · images: ![description](/media/…) (copy the address from Media).";

/** A new key after each successful save, so "add" forms empty themselves. */
function useResetKey(state: WebsiteState, enabled: boolean) {
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (enabled && state.status === "success") setKey(key + 1);
  }
  return key;
}

function Input(props: { state: WebsiteState; name: string; label: string; value?: string | null; max: number; rows?: number; ur?: boolean; hint?: string; placeholder?: string; type?: string }) {
  // Urdu interface removed: keep any saved Urdu text without showing the box.
  if (props.ur) return <input type="hidden" name={props.name} value={props.value ?? ""} />;
  const err = props.state.errors?.[props.name];
  const common = {
    id: props.name,
    name: props.name,
    defaultValue: props.value ?? "",
    maxLength: props.max,
    placeholder: props.placeholder,
    dir: props.ur ? "rtl" : props.type === "url" ? "ltr" : "auto",
    lang: props.ur ? "ur" : undefined,
    className: inputClass,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": describedBy(props.name, err, props.hint),
  } as const;
  return (
    <Field label={props.label} name={props.name} error={err} hint={props.hint}>
      {props.rows ? <textarea rows={props.rows} {...common} /> : <input type={props.type ?? "text"} {...common} />}
    </Field>
  );
}

function Check({ name, label, checked, error }: { name: string; label: string; checked: boolean; error?: string }) {
  return (
    <div>
      <label className="flex items-start gap-3 text-sm text-charcoal-900">
        <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-5 w-5 accent-charcoal-900" />
        {label}
      </label>
      {error && <p className="ms-8 mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function Save({ state, pending, label = "Save" }: { state: WebsiteState; pending: boolean; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="dark" className="py-2" disabled={pending}>{pending ? "Saving…" : label}</Button>
      {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
    </div>
  );
}

// --- Controls ------------------------------------------------------------------------

export function ItemControls({ kind, id, first, last, label }: { kind: Kind; id: string; first: boolean; last: boolean; label: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btn = "rounded-lg border border-white/80 bg-white/60 px-2 py-1 text-xs font-medium disabled:opacity-40";
  const act = (fn: () => Promise<WebsiteState>) => start(async () => { const r = await fn(); if (r.status === "error") setError(r.message ?? "Failed."); });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btn} disabled={pending || first} onClick={() => act(() => moveItemAction(kind, id, "up"))} aria-label={`Move “${label}” up`}>↑</button>
      <button type="button" className={btn} disabled={pending || last} onClick={() => act(() => moveItemAction(kind, id, "down"))} aria-label={`Move “${label}” down`}>↓</button>
      {confirm ? (
        <span role="alertdialog" aria-label={`Delete “${label}”`} className="flex items-center gap-2 text-xs">
          Delete permanently?
          <button type="button" className="font-semibold text-red-700 underline" disabled={pending} onClick={() => act(() => deleteItemAction(kind, id))}>Delete</button>
          <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
        </span>
      ) : (
        <button type="button" className="px-2 text-xs text-red-700 hover:underline" onClick={() => setConfirm(true)}>Delete</button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

export function ImportFaqs({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<WebsiteState | null>(null);
  return (
    <div className="glass-sun space-y-3 rounded-2xl p-5">
      <p className="text-sm">The homepage currently shows {count} built-in FAQs. Copy them here to edit, reorder or add to them.</p>
      <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => start(async () => setResult(await importFaqsAction()))}>
        Copy the current FAQs here
      </Button>
      {result?.status === "error" && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}

// --- FAQ -----------------------------------------------------------------------------

type Faq = { id: string; question: string; questionUr: string | null; answer: string; answerUr: string | null; published: boolean };

export function FaqForm({ faq }: { faq?: Faq }) {
  const [state, onSubmit, pending] = useFormAction(saveFaqAction.bind(null, faq?.id ?? null), idle);
  const key = useResetKey(state, !faq);
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input state={state} name="question" label="Question (English)" value={faq?.question} max={300} />
        <Input state={state} name="questionUr" label="Question (Urdu, optional)" value={faq?.questionUr} max={300} ur />
        <Input state={state} name="answer" label="Answer (English)" value={faq?.answer} max={5000} rows={4} />
        <Input state={state} name="answerUr" label="Answer (Urdu, optional)" value={faq?.answerUr} max={5000} rows={4} ur />
      </div>
      <Check name="published" label="Published (shown on the homepage)" checked={faq?.published ?? true} />
      <Save state={state} pending={pending} label={faq ? "Save" : "Add FAQ"} />
    </form>
  );
}

// --- Testimonial -----------------------------------------------------------------------------

type Testimonial = {
  id: string; name: string; roleTitle: string | null; company: string | null; quote: string; quoteUr: string | null;
  photoId: string | null; consentConfirmed: boolean; published: boolean; featured: boolean;
};

export function TestimonialForm({ item, images }: { item?: Testimonial; images: ImageOption[] }) {
  const [state, onSubmit, pending] = useFormAction(saveTestimonialAction.bind(null, item?.id ?? null), idle);
  const key = useResetKey(state, !item);
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input state={state} name="name" label="Name" value={item?.name} max={120} />
        <Input state={state} name="roleTitle" label="Role (optional)" value={item?.roleTitle} max={160} placeholder="e.g. Founder" />
        <Input state={state} name="company" label="Company (optional)" value={item?.company} max={160} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input state={state} name="quote" label="What they said (English or as written)" value={item?.quote} max={2000} rows={4} />
        <Input state={state} name="quoteUr" label="Urdu version (optional)" value={item?.quoteUr} max={2000} rows={4} ur />
      </div>
      <ImagePicker name="photoId" label="Photo (optional, public image)" images={images} value={item?.photoId ?? ""} error={state.errors?.photoId} />
      <Check name="consentConfirmed" label="I have this person's permission to publish their name and words" checked={item?.consentConfirmed ?? false} error={state.errors?.consentConfirmed} />
      <div className="flex flex-wrap gap-6">
        <Check name="published" label="Published" checked={item?.published ?? false} />
        <Check name="featured" label="Show first" checked={item?.featured ?? false} />
      </div>
      <Save state={state} pending={pending} label={item ? "Save" : "Add testimonial"} />
    </form>
  );
}

// --- Case study --------------------------------------------------------------------------------

type CaseStudy = {
  id: string; title: string; titleUr: string | null; slug: string; client: string | null; summary: string; summaryUr: string | null;
  body: string; bodyUr: string | null; serviceSlug: string | null; coverImageId: string | null; consentConfirmed: boolean; published: boolean;
};

export function CaseStudyForm({ item, images, services }: { item?: CaseStudy; images: ImageOption[]; services: { slug: string; title: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(saveCaseStudyAction.bind(null, item?.id ?? null), idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input state={state} name="title" label="Title (English)" value={item?.title} max={200} />
        <Input state={state} name="titleUr" label="Title (Urdu, optional)" value={item?.titleUr} max={200} ur />
        <Input state={state} name="slug" label="Web address" value={item?.slug} max={80} type="url" hint="e.g. shopify-store-for-ayesha-crafts. Leave empty to create it from the title." placeholder="created from the title" />
        <Input state={state} name="client" label="Client name (optional)" value={item?.client} max={160} />
        <Input state={state} name="summary" label="Summary (English)" value={item?.summary} max={500} rows={3} />
        <Input state={state} name="summaryUr" label="Summary (Urdu, optional)" value={item?.summaryUr} max={500} rows={3} ur />
      </div>
      <Input state={state} name="body" label="Case study (English)" value={item?.body} max={100000} rows={14} hint={formatting} />
      <Input state={state} name="bodyUr" label="Case study (Urdu, optional)" value={item?.bodyUr} max={100000} rows={8} ur />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Related service" name="serviceSlug">
          <select id="serviceSlug" name="serviceSlug" defaultValue={item?.serviceSlug ?? ""} className={inputClass}>
            <option value="">None</option>
            {services.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
          </select>
        </Field>
        <ImagePicker name="coverImageId" label="Cover image (optional)" images={images} value={item?.coverImageId ?? ""} error={state.errors?.coverImageId} />
      </div>
      <Check name="consentConfirmed" label="The client agreed to this case study being published" checked={item?.consentConfirmed ?? false} error={state.errors?.consentConfirmed} />
      <Check name="published" label="Published" checked={item?.published ?? false} />
      <Save state={state} pending={pending} label={item ? "Save case study" : "Create case study"} />
    </form>
  );
}
