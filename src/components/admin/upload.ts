"use client";

export type UploadResult = { ok: true; asset: { id: string; url: string; name: string } } | { ok: false; error: string };

/** XHR upload so the browser can report progress (fetch can't). */
export function uploadFile(form: FormData, onProgress: (fraction: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, error: xhr.status === 413 ? "The file is too large." : "The upload failed. Please try again." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error. Check your connection and try again." });
    xhr.send(form);
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
