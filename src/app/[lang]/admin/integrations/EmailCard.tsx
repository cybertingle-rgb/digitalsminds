"use client";

import { useState, useTransition } from "react";
import { Notice, StatusBadge } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import type { SmtpStatus } from "@/modules/settings/integrations";
import { saveSmtpAction, sendTestEmailAction, type ActionState } from "./actions";

export function EmailCard({ status, adminEmail }: { status: SmtpStatus; adminEmail: string }) {
  const [saveState, onSave, saving] = useFormAction<ActionState>(saveSmtpAction, { status: "idle" });
  const [testState, setTestState] = useState<ActionState | null>(null);
  const [testing, startTest] = useTransition();
  const f = saveState.fields ?? {};

  return (
    <section aria-labelledby="email-title" className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="email-title" className="text-lg font-semibold text-charcoal-900">Email (SMTP)</h2>
          <p className="mt-1 text-sm text-muted">Sends account verification, password reset and notification emails, e.g. from noreply@digitalsminds.com.</p>
        </div>
        {status.verifiedAt ? (
          <StatusBadge tone="ok">Working</StatusBadge>
        ) : status.configured ? (
          <StatusBadge tone="warn">Saved · send a test email</StatusBadge>
        ) : (
          <StatusBadge tone="off">Not set up</StatusBadge>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {status.configured && !status.secretReadable && (
          <Notice tone="error">The saved mailbox password can no longer be read (the site&apos;s BETTER_AUTH_SECRET changed). Enter the password again and save.</Notice>
        )}
        {saveState.message && <Notice tone={saveState.status === "error" ? "error" : "success"}>{saveState.message}</Notice>}
        {testState?.message && <Notice tone={testState.status === "error" ? "error" : "success"}>{testState.message}</Notice>}
      </div>

      <details className="mt-5 rounded-xl bg-surface-alt p-4" open={!status.configured}>
        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Hostinger mailbox settings</summary>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-charcoal-800">
          <li>In hPanel → Emails, create the mailbox <strong>noreply@digitalsminds.com</strong> with a strong password.</li>
          <li>Use host <strong>smtp.hostinger.com</strong>, port <strong>465</strong> with SSL on, and the full mailbox address as the username.</li>
          <li>Save, then send a test email. If students report missing emails, ask them to check spam.</li>
        </ol>
      </details>

      <form onSubmit={onSave} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="SMTP host" name="host" error={f.host}>
          <input id="host" name="host" dir="ltr" required defaultValue={status.host ?? "smtp.hostinger.com"} className={inputClass} aria-invalid={!!f.host} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Port" name="port" error={f.port}>
            <input id="port" name="port" type="number" dir="ltr" required defaultValue={status.port ?? 465} className={inputClass} aria-invalid={!!f.port} />
          </Field>
          <label className="mt-7 flex items-center gap-2 text-sm">
            <input name="secure" type="checkbox" defaultChecked={status.secure} className="h-5 w-5 accent-charcoal-900" />
            SSL/TLS
          </label>
        </div>
        <Field label="Mailbox (username)" name="username" error={f.username}>
          <input id="username" name="username" dir="ltr" required autoComplete="off" defaultValue={status.username ?? "noreply@digitalsminds.com"} className={inputClass} aria-invalid={!!f.username} />
        </Field>
        <Field
          label="Mailbox password"
          name="password"
          error={f.password}
          hint={status.configured ? "Saved (hidden). Leave empty to keep it." : "Stored encrypted. It is never shown again."}
        >
          <input id="password" name="password" type="password" autoComplete="new-password" required={!status.configured} className={inputClass} placeholder={status.configured ? "••••••••••••" : ""} />
        </Field>
        <Field label="Sender name" name="fromName" error={f.fromName}>
          <input id="fromName" name="fromName" required defaultValue={status.fromName ?? "Digitals Minds"} className={inputClass} aria-invalid={!!f.fromName} />
        </Field>
        <Field label="Sender email" name="fromEmail" error={f.fromEmail}>
          <input id="fromEmail" name="fromEmail" type="email" dir="ltr" required defaultValue={status.fromEmail ?? "noreply@digitalsminds.com"} className={inputClass} aria-invalid={!!f.fromEmail} />
        </Field>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit" variant="dark" disabled={saving}>
            {saving ? "Saving and connecting…" : "Save & check connection"}
          </Button>
          {status.configured && (
            <Button type="button" disabled={testing} onClick={() => startTest(async () => setTestState(await sendTestEmailAction()))}>
              {testing ? "Sending…" : `Send test email to ${adminEmail}`}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
