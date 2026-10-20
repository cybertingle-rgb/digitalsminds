"use client";

import { useState, useTransition } from "react";
import { deleteSubscriberAction } from "./actions";

export function DeleteSubscriber({ id, email }: { id: string; email: string }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span className="text-xs text-muted">{msg}</span>;
  if (!confirm) return <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => setConfirm(true)} aria-label={`Remove ${email}`}>Remove</button>;
  return (
    <span role="alertdialog" aria-label={`Remove ${email}`} className="flex flex-wrap items-center justify-end gap-2 text-xs">
      Delete permanently?
      <button type="button" disabled={pending} className="font-semibold text-red-700 underline" onClick={() => start(async () => setMsg((await deleteSubscriberAction(id)).message))}>Delete</button>
      <button type="button" className="underline" onClick={() => setConfirm(false)}>Cancel</button>
    </span>
  );
}
