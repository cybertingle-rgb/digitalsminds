"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { saveAttendanceAction, type AttendanceState } from "./actions";

type Row = { id: string; name: string; email: string; status: string | null; note: string | null };
const OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
] as const;

/** One row per student; "Mark all present" fills the unmarked ones. */
export function AttendanceForm({ batchId, liveClassId, rows, disabled }: { batchId: string; liveClassId: string; rows: Row[]; disabled: boolean }) {
  const [state, onSubmit, pending] = useFormAction(saveAttendanceAction.bind(null, batchId, liveClassId), { status: "idle" } as AttendanceState);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, r.status ?? ""])));
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => setValues((v) => Object.fromEntries(rows.map((r) => [r.id, v[r.id] || "PRESENT"])))}>Mark unmarked as present</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr><th className="py-2 pe-3">Student</th><th className="py-2 pe-3">Attendance</th><th className="py-2">Note (optional)</th></tr>
          </thead>
          <tbody className="divide-y divide-charcoal-200/50">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pe-3">
                  <input type="hidden" name="enrollmentId" value={r.id} />
                  <span className="font-semibold text-charcoal-900">{r.name}</span>
                  <span className="block text-xs text-muted">{r.email}</span>
                </td>
                <td className="py-2 pe-3">
                  <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
                    <legend className="sr-only">Attendance for {r.name}</legend>
                    {OPTIONS.map((o) => (
                      <label key={o.value} className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 ${values[r.id] === o.value ? "bg-charcoal-900 text-white ring-charcoal-900" : "bg-white/70 text-charcoal-800 ring-charcoal-200"}`}>
                        <input type="radio" className="sr-only" name={`status.${r.id}`} value={o.value} checked={values[r.id] === o.value} onChange={() => setValues((v) => ({ ...v, [r.id]: o.value }))} />
                        {o.label}
                      </label>
                    ))}
                    {values[r.id] && (
                      <button type="button" className="text-xs text-muted underline" onClick={() => setValues((v) => ({ ...v, [r.id]: "" }))}>Clear</button>
                    )}
                  </fieldset>
                  {/* An unticked radio group sends nothing; this sends "" so a cleared mark is removed. */}
                  {!values[r.id] && <input type="hidden" name={`status.${r.id}`} value="" />}
                </td>
                <td className="py-2">
                  <input name={`note.${r.id}`} defaultValue={r.note ?? ""} maxLength={300} disabled={disabled} aria-label={`Note for ${r.name}`} className="w-full rounded-lg border border-charcoal-200 bg-white/80 px-2 py-1" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending || disabled}>{pending ? "Saving…" : "Save attendance"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
    </form>
  );
}
