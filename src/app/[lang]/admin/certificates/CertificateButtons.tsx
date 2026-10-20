"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { issueAction, revokeAction, type CertState } from "./actions";

export function IssueButton({ enrollmentId }: { enrollmentId: string }) {
  const [result, setResult] = useState<CertState | null>(null);
  const [pending, start] = useTransition();
  if (result?.status === "success") return <Notice tone="success">{result.message}</Notice>;
  return (
    <div className="space-y-2">
      <Button type="button" className="py-2" disabled={pending} onClick={() => start(async () => setResult(await issueAction(enrollmentId)))}>
        {pending ? "Issuing…" : "Issue certificate"}
      </Button>
      {result && <Notice tone="error">{result.message}</Notice>}
    </div>
  );
}

export function RevokeButton({ id, code }: { id: string; code: string }) {
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<CertState | null>(null);
  const [pending, start] = useTransition();
  if (result) return <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>;
  if (!confirm) return <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => setConfirm(true)}>Revoke</button>;
  return (
    <span role="alertdialog" aria-label={`Revoke ${code}`} className="flex flex-wrap items-center gap-2 text-xs">
      Revoke {code}? Anyone checking it will see it is no longer valid.
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setResult(await revokeAction(id)))}>Revoke</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
    </span>
  );
}
