"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { deleteDocumentAction, setDocumentPublishedAction, type OnboardingState } from "../onboarding/actions";

export function UploadDocument({ scopes }: { scopes: { value: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [key, setKey] = useState(0);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/documents", { method: "POST", body: new FormData(e.currentTarget) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        setResult({ ok: true, message: "Uploaded. Students it's for can download it from their portal." });
        setKey(key + 1);
        router.refresh();
      } else setResult({ ok: false, message: json?.error ?? "The upload failed. Please try again." });
    } catch {
      setResult({ ok: false, message: "The upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form key={key} onSubmit={onSubmit} className="space-y-4" noValidate encType="multipart/form-data">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="doc-title">
          <input id="doc-title" name="title" required maxLength={200} placeholder="e.g. Class rules and code of conduct" className={inputClass} />
        </Field>
        <Field label="For" name="doc-scope">
          <select id="doc-scope" name="scope" defaultValue="all" className={inputClass}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Short description (optional)" name="doc-description">
        <input id="doc-description" name="description" maxLength={500} className={inputClass} />
      </Field>
      <Field label="File" name="doc-file" hint="PDF, Word, Excel, PowerPoint, or a JPG/PNG/WebP image, up to 25 MB. Stored privately.">
        <input id="doc-file" name="file" type="file" required accept=".pdf,.docx,.xlsx,.pptx,image/jpeg,image/png,image/webp" className={`${inputClass} file:me-3 file:rounded-lg file:border-0 file:bg-charcoal-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`} aria-describedby="doc-file-hint" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={busy}>{busy ? "Uploading…" : "Upload document"}</Button>
        {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      </div>
    </form>
  );
}

export function DocumentActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<OnboardingState | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <span className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" disabled={pending} className="font-semibold underline underline-offset-4" onClick={() => start(async () => setResult(await setDocumentPublishedAction(id, !published)))}>
        {published ? "Hide from students" : "Show to students"}
      </button>
      {!confirm ? (
        <button type="button" className="text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirm(true)}>Delete…</button>
      ) : (
        <>
          <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setResult(await deleteDocumentAction(id)))}>Delete permanently</button>
          <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
        </>
      )}
      {result?.status === "error" && <span className="text-red-700">{result.message}</span>}
    </span>
  );
}
