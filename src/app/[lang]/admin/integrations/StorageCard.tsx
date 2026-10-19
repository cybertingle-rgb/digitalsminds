"use client";

import { useState, useTransition } from "react";
import { Notice, StatusBadge } from "@/components/admin/ui";
import { formatBytes } from "@/components/admin/upload";
import { Button } from "@/components/ui/Button";
import type { StorageStatus } from "@/modules/media/storage-check";
import { runStorageCheckAction, type ActionState } from "./actions";

export function StorageCard({ status }: { status: StorageStatus }) {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();

  const badge = status.problem ? (
    <StatusBadge tone="warn">Needs attention</StatusBadge>
  ) : status.persistent ? (
    <StatusBadge tone="ok">Confirmed · uploads on</StatusBadge>
  ) : status.devMode ? (
    <StatusBadge tone="ok">Development · uploads on</StatusBadge>
  ) : (
    <StatusBadge tone="warn">Waiting for a redeploy</StatusBadge>
  );

  return (
    <section id="storage" aria-labelledby="storage-title" className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="storage-title" className="text-lg font-semibold text-charcoal-900">File storage</h2>
          <p className="mt-1 text-sm text-muted">Where uploaded images and documents are kept. It must be outside the app folder, which is replaced on every deploy.</p>
        </div>
        {badge}
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Folder</dt>
          <dd className="break-all font-mono text-xs text-charcoal-900" dir="ltr">{status.root}</dd>
        </div>
        <div>
          <dt className="text-muted">Free disk space (approx.)</dt>
          <dd className="text-charcoal-900">{status.freeBytes === null ? "Unknown" : formatBytes(status.freeBytes)}</dd>
        </div>
      </dl>

      <div className="mt-5 space-y-3">
        {status.problem && <Notice tone="error">{status.problem}</Notice>}
        {!status.problem && !status.persistent && !status.devMode && (
          <Notice tone="info">
            Step 1: click <strong>Run check</strong> (creates a marker file). Step 2: redeploy the site in Hostinger. Step 3: come back and click
            <strong> Run check</strong> again. If the marker survived the redeploy, uploads switch on. If it didn&apos;t, files would be lost on
            every deploy, and we need a different folder or external storage.
          </Notice>
        )}
        {status.persistent && <Notice tone="success">Files in this folder survived a redeploy, so uploads are safe here. Include this folder in your backups.</Notice>}
        {result?.message && <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>}
      </div>

      <div className="mt-5">
        <Button type="button" variant="dark" disabled={pending} onClick={() => start(async () => setResult(await runStorageCheckAction()))}>
          {pending ? "Checking…" : "Run check"}
        </Button>
        {status.lastCheckedAt && <span className="ms-3 text-xs text-muted">Last checked {new Date(status.lastCheckedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</span>}
      </div>
    </section>
  );
}
