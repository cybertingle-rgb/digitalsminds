"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Notice, StatusBadge } from "@/components/admin/ui";
import { formatBytes, uploadFile } from "@/components/admin/upload";
import { inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { deleteMediaAction, updateAltAction, type MediaActionState } from "./actions";

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  isImage: boolean;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  visibility: "PUBLIC" | "PRIVATE";
  altText: string;
  altTextUr: string;
  uploadedBy: string;
  uploadedAt: string;
};

export function MediaGrid({ items, siteUrl }: { items: MediaItem[]; siteUrl: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<MediaActionState | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  const run = (fn: () => Promise<MediaActionState>) =>
    start(async () => {
      const r = await fn();
      setNotice(r);
      if (r.status === "success") {
        setEditing(null);
        setConfirmDelete(null);
      }
    });

  async function replace(file: File) {
    const id = replaceTarget.current;
    if (!id) return;
    const form = new FormData();
    form.set("file", file);
    form.set("replaceId", id);
    setNotice({ status: "success", message: `Replacing with ${file.name}…` });
    const res = await uploadFile(form, () => {});
    setNotice(res.ok ? { status: "success", message: "File replaced. Existing links keep working." } : { status: "error", message: res.error });
    router.refresh();
  }

  if (items.length === 0) return <p className="rounded-2xl border border-line bg-white p-6 text-muted">No files yet. Upload your first file above.</p>;

  return (
    <section aria-label="Files" className="space-y-4">
      {notice && <Notice tone={notice.status === "error" ? "error" : "success"}>{notice.message}</Notice>}
      <input
        ref={replaceInput}
        type="file"
        className="sr-only"
        aria-label="Choose a replacement file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) replace(f);
          e.target.value = "";
        }}
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((m) => (
          <li key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden border-b border-line bg-charcoal-50">
              {m.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file, sizes vary
                <img src={m.url} alt={m.altText || m.name} className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
              ) : (
                <span className="rounded-lg bg-charcoal-900 px-3 py-2 text-sm font-bold uppercase text-sun-400">{m.ext}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4 text-sm">
              <p className="truncate font-semibold text-charcoal-900" title={m.name}>{m.name}</p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={m.visibility === "PUBLIC" ? "ok" : "warn"}>{m.visibility === "PUBLIC" ? "Public" : "Private"}</StatusBadge>
                <StatusBadge tone="off">{formatBytes(m.size)}{m.width ? ` · ${m.width}×${m.height}` : ""}</StatusBadge>
              </div>
              <p className="text-xs text-muted">{m.uploadedBy} · {m.uploadedAt}</p>
              {m.isImage && !m.altText && <p className="text-xs text-gold-700">Add a description for screen readers and SEO.</p>}

              {editing === m.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    run(() => updateAltAction(m.id, String(fd.get("alt") ?? ""), String(fd.get("altUr") ?? "")));
                  }}
                >
                  <label className="block text-xs font-medium" htmlFor={`alt-${m.id}`}>Description (English)</label>
                  <input id={`alt-${m.id}`} name="alt" defaultValue={m.altText} maxLength={255} className={`${inputClass} mt-0`} />
                  <label className="block text-xs font-medium" htmlFor={`altur-${m.id}`}>Description (Urdu)</label>
                  <input id={`altur-${m.id}`} name="altUr" dir="rtl" lang="ur" defaultValue={m.altTextUr} maxLength={255} className={`${inputClass} mt-0`} />
                  <div className="flex gap-2">
                    <Button type="submit" variant="dark" className="py-2" disabled={pending}>Save</Button>
                    <Button type="button" variant="secondary" className="py-2" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : confirmDelete === m.id ? (
                <div role="alertdialog" aria-label="Confirm delete" className="rounded-lg border border-sun-400 bg-sun-50 p-3">
                  <p className="font-semibold text-charcoal-900">Delete this file permanently?</p>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => run(() => deleteMediaAction(m.id))}>Delete</Button>
                    <Button type="button" variant="secondary" className="py-2" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2">
                  {m.visibility === "PUBLIC" && (
                    <button
                      type="button"
                      className="font-medium underline-offset-4 hover:underline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${siteUrl}${m.url}`);
                        setCopied(m.id);
                        setTimeout(() => setCopied(null), 2000);
                      }}
                    >
                      {copied === m.id ? "Link copied" : "Copy link"}
                    </button>
                  )}
                  <a href={m.url} target="_blank" rel="noopener" className="font-medium underline-offset-4 hover:underline">Open</a>
                  <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => setEditing(m.id)}>Description</button>
                  <button
                    type="button"
                    className="font-medium underline-offset-4 hover:underline"
                    onClick={() => {
                      replaceTarget.current = m.id;
                      replaceInput.current?.click();
                    }}
                  >
                    Replace
                  </button>
                  <button type="button" className="font-medium text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirmDelete(m.id)}>Delete</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
