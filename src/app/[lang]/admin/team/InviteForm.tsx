"use client";

import { Notice } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { inviteAction, type TeamState } from "./actions";

export function InviteForm() {
  const [state, onSubmit, pending] = useFormAction<TeamState>(inviteAction, { status: "idle" });
  const f = state.fields ?? {};
  return (
    <section aria-labelledby="invite-title" className="glass rounded-2xl p-6">
      <h2 id="invite-title" className="text-lg font-semibold text-charcoal-900">Invite a team member</h2>
      <p className="mt-1 text-sm text-muted">They receive an email link to set their own password. If the email already has a student account, it gets team access instead.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Name" name="name" error={f.name}>
          <input id="name" name="name" required className={inputClass} aria-invalid={!!f.name} />
        </Field>
        <Field label="Email" name="email" error={f.email}>
          <input id="email" name="email" type="email" dir="ltr" required className={inputClass} aria-invalid={!!f.email} />
        </Field>
        <Field label="Role" name="role" error={f.role}>
          <select id="role" name="role" defaultValue="CONTENT_MANAGER" className={inputClass}>
            <option value="CONTENT_MANAGER">Content Manager</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </Field>
        <div className="sm:col-span-3 space-y-3">
          {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
          <Button type="submit" variant="dark" disabled={pending}>
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </section>
  );
}
