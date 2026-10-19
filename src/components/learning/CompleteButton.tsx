"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setCompleteAction } from "@/app/[lang]/(marketing)/courses/actions";

export function CompleteButton(props: { slug: string; lessonId: string; done: boolean; labels: { mark: string; completed: string; undo: string } }) {
  const router = useRouter();
  const [done, setDone] = useState(props.done);
  const [pending, start] = useTransition();
  const toggle = (next: boolean) =>
    start(async () => {
      const r = await setCompleteAction(props.slug, props.lessonId, next);
      if (r) {
        setDone(next);
        router.refresh();
      }
    });

  if (done) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span role="status" className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-900">
          <span aria-hidden="true">✓</span> {props.labels.completed}
        </span>
        <button type="button" disabled={pending} onClick={() => toggle(false)} className="text-sm text-muted underline-offset-4 hover:underline">
          {props.labels.undo}
        </button>
      </div>
    );
  }
  return (
    <Button type="button" variant="dark" disabled={pending} onClick={() => toggle(true)}>
      {props.labels.mark}
    </Button>
  );
}
