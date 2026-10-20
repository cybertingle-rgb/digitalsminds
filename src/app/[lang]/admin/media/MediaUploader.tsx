"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Notice } from "@/components/admin/ui";
import { formatBytes, uploadFile } from "@/components/admin/upload";
import { inputClass } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";

type Item = { name: string; size: number; progress: number; state: "uploading" | "done" | "error"; message?: string };

export function MediaUploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some((i) => i.state === "uploading");

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    const start = items.length;
    setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, size: f.size, progress: 0, state: "uploading" as const }))]);
    for (const [i, file] of list.entries()) {
      const idx = start + i;
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", visibility);
      const res = await uploadFile(form, (p) => setItems((prev) => prev.map((it, j) => (j === idx ? { ...it, progress: p } : it))));
      setItems((prev) =>
        prev.map((it, j) => (j === idx ? { ...it, progress: 1, state: res.ok ? "done" : "error", message: res.ok ? undefined : res.error } : it)),
      );
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="upload-title" className="glass rounded-2xl p-6">
      <h2 id="upload-title" className="text-lg font-semibold text-charcoal-900">Upload files</h2>
      <p className="mt-1 text-sm text-muted">
        Images: JPG, PNG or WebP up to 8 MB (location and camera data are removed). Documents: PDF, Word, Excel or PowerPoint up to 25 MB.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="visibility" className="text-sm font-medium text-charcoal-900">Who can access</label>
        <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")} className={`${inputClass} mt-0 w-auto py-2`}>
          <option value="PUBLIC">Public (logos, thumbnails, website images)</option>
          <option value="PRIVATE">Private (course materials, staff only until enrollment opens)</option>
        </select>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center ${
          dragging ? "border-sun-400 bg-sun-50" : "border-charcoal-200"
        }`}
      >
        <p className="text-sm text-muted">Drag files here, or</p>
        <Button type="button" variant="dark" disabled={busy} onClick={() => input.current?.click()}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx"
          className="sr-only"
          aria-label="Choose files to upload"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="glass-subtle rounded-xl p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate font-medium text-charcoal-900">{it.name}</span>
                <span className="shrink-0 text-muted">{formatBytes(it.size)}</span>
              </div>
              {it.state === "uploading" && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-charcoal-100" role="progressbar" aria-label={`Uploading ${it.name}`} aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-sun-400 transition-all" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                </div>
              )}
              {it.state === "done" && <p className="mt-1 text-green-800">Uploaded</p>}
              {it.state === "error" && <div className="mt-2"><Notice tone="error">{it.message ?? "Upload failed."}</Notice></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
