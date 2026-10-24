"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { deleteCategoryAction, deleteServiceAction, saveCategoryAction, saveServiceAction, type CatalogState } from "./actions";

const idle: CatalogState = { status: "idle" };

function useFollow(state: CatalogState | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
}

function Result({ state }: { state: CatalogState | null }) {
  if (!state?.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

export type ServiceValue = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  offerings: string;
  idealFor: string;
  notice: string;
  categoryId: string;
  sortOrder: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string;
  seoDescription: string;
};

export const emptyService: ServiceValue = {
  slug: "",
  title: "",
  shortTitle: "",
  summary: "",
  description: "",
  offerings: "",
  idealFor: "",
  notice: "",
  categoryId: "",
  sortOrder: "100",
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
};

export function ServiceForm({ id, value, categories }: { id?: string; value: ServiceValue; categories: { id: string; title: string }[] }) {
  const [state, onSubmit, pending] = useFormAction(saveServiceAction.bind(null, id ?? null), idle);
  useFollow(state);
  const e = (k: string) => state.errors?.[k];
  const input = (name: keyof ServiceValue, label: string, opts: { hint?: string; max: number; rows?: number; placeholder?: string; dir?: "ltr" | "auto" }) => (
    <Field label={label} name={name} error={e(name)} hint={opts.hint}>
      {opts.rows ? (
        <textarea id={name} name={name} rows={opts.rows} maxLength={opts.max} defaultValue={value[name]} placeholder={opts.placeholder} dir={opts.dir ?? "auto"} className={inputClass} aria-invalid={e(name) ? true : undefined} aria-describedby={describedBy(name, e(name), opts.hint)} />
      ) : (
        <input id={name} name={name} maxLength={opts.max} defaultValue={value[name]} placeholder={opts.placeholder} dir={opts.dir ?? "auto"} className={inputClass} aria-invalid={e(name) ? true : undefined} aria-describedby={describedBy(name, e(name), opts.hint)} />
      )}
    </Field>
  );
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {input("title", "Name", { max: 160, placeholder: "e.g. Suspended Account Reinstatement Support" })}
        {input("shortTitle", "Short name (optional)", { max: 80, hint: "Used in compact lists." })}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {input("slug", "Web address", { max: 100, dir: "ltr", hint: "/services/… · lowercase letters, numbers and dashes. Changing it breaks old links." })}
        <Field label="Category" name="categoryId" error={e("categoryId")}>
          <select id="categoryId" name="categoryId" defaultValue={value.categoryId} className={inputClass}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" name="status" error={e("status")}>
            <select id="status" name="status" defaultValue={value.status} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          {input("sortOrder", "Order", { max: 4, dir: "ltr" })}
        </div>
      </div>
      {input("summary", "Summary", { max: 500, rows: 2, hint: "One or two sentences for cards and search results." })}
      {input("description", "Description", { max: 10000, rows: 5 })}
      <div className="grid gap-5 sm:grid-cols-2">
        {input("offerings", "What's included", { max: 6000, rows: 8, hint: "One item per line." })}
        {input("idealFor", "Ideal for (optional)", { max: 3000, rows: 8, hint: "One per line." })}
      </div>
      {input("notice", "Notice (optional)", {
        max: 3000,
        rows: 3,
        hint: "Scope and limits shown on the page, e.g. that approval or reinstatement is the platform's decision and can't be guaranteed.",
      })}
      <div className="grid gap-5 sm:grid-cols-2">
        {input("seoTitle", "Search title (optional)", { max: 200 })}
        {input("seoDescription", "Search description (optional)", { max: 320 })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save service" : "Create service"}</Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function DeleteService({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CatalogState | null>(null);
  const [confirm, setConfirm] = useState(false);
  useFollow(result);
  if (!confirm) return <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirm(true)}>Delete service…</button>;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Delete this service? Its page disappears; inquiries about it are kept. (Archiving hides it and keeps the text.)
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setResult(await deleteServiceAction(id)))}>Delete</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
      {result?.status === "error" && <span className="text-red-700">{result.message}</span>}
    </span>
  );
}

export type CategoryValue = { slug: string; title: string; titleUr: string; summary: string; summaryUr: string; notice: string; sortOrder: string; active: boolean };
export const emptyCategory: CategoryValue = { slug: "", title: "", titleUr: "", summary: "", summaryUr: "", notice: "", sortOrder: "100", active: true };

export function CategoryForm({ id, value }: { id?: string; value: CategoryValue }) {
  const [state, onSubmit, pending] = useFormAction(saveCategoryAction.bind(null, id ?? null), idle);
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success" && !id) setKey(key + 1);
  }
  const e = (k: string) => state.errors?.[k];
  const p = (k: string) => (id ? `${k}-${id}` : k);
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Name" name={p("title")} error={e("title")}>
            <input id={p("title")} name="title" defaultValue={value.title} maxLength={160} className={inputClass} aria-invalid={e("title") ? true : undefined} />
          </Field>
        </div>
        <Field label="Web address" name={p("slug")} error={e("slug")} hint="/courses?category=…">
          <input id={p("slug")} name="slug" defaultValue={value.slug} maxLength={100} dir="ltr" className={inputClass} aria-invalid={e("slug") ? true : undefined} />
        </Field>
      </div>
      <Field label="Summary (optional)" name={p("summary")} error={e("summary")}>
        <textarea id={p("summary")} name="summary" rows={2} maxLength={500} defaultValue={value.summary} className={inputClass} />
      </Field>
      <Field label="Notice on its program and service pages (optional)" name={p("notice")} error={e("notice")} hint="e.g. eligibility depends on the marketplace's policies; approval can't be guaranteed.">
        <textarea id={p("notice")} name="notice" rows={3} maxLength={3000} defaultValue={value.notice} className={inputClass} />
      </Field>
      <input type="hidden" name="titleUr" value={value.titleUr} />
      <input type="hidden" name="summaryUr" value={value.summaryUr} />
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={value.active} className="h-5 w-5 accent-charcoal-900" /> Shown on the website</label>
        <label className="flex items-center gap-2">Order <input name="sortOrder" type="number" min={0} max={9999} defaultValue={value.sortOrder} className="w-24 rounded-lg border border-charcoal-200 px-2 py-1" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : id ? "Save category" : "Add category"}</Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function DeleteCategory({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CatalogState | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  if (!confirm) return <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirm(true)}>Delete…</button>;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Delete this category? Its programs and services stay, uncategorised.
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setResult(await deleteCategoryAction(id)))}>Delete</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
      {result?.status === "error" && <span className="text-red-700">{result.message}</span>}
    </span>
  );
}
