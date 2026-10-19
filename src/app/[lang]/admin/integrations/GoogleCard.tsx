"use client";

import { useState, useTransition } from "react";
import { CopyField, Notice, StatusBadge } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import type { GoogleStatus } from "@/modules/settings/integrations";
import { removeGoogleAction, saveGoogleAction, setGoogleEnabledAction, type ActionState } from "./actions";

type Props = { status: GoogleStatus; origin: string; redirectUri: string; flash: "linked" | "error" | "unverified" | null };

export function GoogleCard({ status, origin, redirectUri, flash }: Props) {
  const [saveState, onSave, saving] = useFormAction<ActionState>(saveGoogleAction, { status: "idle" });
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const badge = status.enabled ? (
    <StatusBadge tone="ok">Connected · shown to students</StatusBadge>
  ) : status.verifiedAt ? (
    <StatusBadge tone="ok">Connected · hidden from students</StatusBadge>
  ) : status.configured ? (
    <StatusBadge tone="warn">Saved · not tested yet</StatusBadge>
  ) : (
    <StatusBadge tone="off">Not connected</StatusBadge>
  );

  async function connect() {
    setConnecting(true);
    await authClient.linkSocial({
      provider: "google",
      callbackURL: "/admin/integrations?google=linked",
      errorCallbackURL: "/admin/integrations?google=error",
    });
    setConnecting(false);
  }

  const run = (fn: () => Promise<ActionState>) => startTransition(async () => setResult(await fn()));
  const f = saveState.fields ?? {};

  return (
    <section aria-labelledby="google-title" className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="google-title" className="text-lg font-semibold text-charcoal-900">Google</h2>
          <p className="mt-1 text-sm text-muted">Lets students sign in with their Google account and records the Google email used for course videos.</p>
        </div>
        {badge}
      </div>

      <div className="mt-5 space-y-3">
        {status.configured && !status.secretReadable && (
          <Notice tone="error">The saved Client secret can no longer be read (the site&apos;s BETTER_AUTH_SECRET changed). Paste the Client secret again and save.</Notice>
        )}
        {flash === "linked" && <Notice tone="success">Google sign-in works. You can now show it to students below.</Notice>}
        {flash === "unverified" && <Notice tone="error">Google returned, but no linked account was found. Please try “Connect &amp; test” again.</Notice>}
        {flash === "error" && (
          <Notice tone="error">
            Google sign-in failed. The most common cause is a redirect URL mismatch: make sure the URL below is listed exactly under
            “Authorized redirect URIs” in Google Cloud, then try again.
          </Notice>
        )}
        {result?.message && <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>}
        {saveState.message && <Notice tone={saveState.status === "error" ? "error" : "success"}>{saveState.message}</Notice>}
      </div>

      <details className="mt-5 rounded-xl bg-surface-alt p-4" open={!status.configured}>
        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">How to get your Google credentials (5 minutes)</summary>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-charcoal-800">
          <li>
            Open{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              Google Cloud Console → Credentials
            </a>{" "}
            and sign in with the Google account that should own this setup. Create a project if asked (e.g. “Digitals Minds”).
          </li>
          <li>Open “OAuth consent screen”: choose <strong>External</strong>, app name “Digitals Minds”, support email info@digitalsminds.com, then publish the app.</li>
          <li>Back in Credentials: <strong>Create credentials → OAuth client ID</strong>, type <strong>Web application</strong>.</li>
          <li>Add the two values below (Authorized JavaScript origin and Authorized redirect URI) and click Create.</li>
          <li>Copy the <strong>Client ID</strong> and <strong>Client secret</strong> into this form, Save, then click <strong>Connect &amp; test</strong>.</li>
        </ol>
        <div className="mt-4 grid gap-3">
          <CopyField label="Authorized JavaScript origin" value={origin} />
          <CopyField label="Authorized redirect URI" value={redirectUri} />
        </div>
      </details>

      <form onSubmit={onSave} className="mt-5 grid gap-4">
        <Field label="Client ID" name="clientId" error={f.clientId}>
          <input id="clientId" name="clientId" dir="ltr" defaultValue={status.clientId ?? ""} required autoComplete="off" className={inputClass} aria-invalid={!!f.clientId} placeholder="1234567890-abc.apps.googleusercontent.com" />
        </Field>
        <Field
          label="Client secret"
          name="clientSecret"
          error={f.clientSecret}
          hint={status.configured ? "Saved (hidden). Leave empty to keep it, or paste a new one to replace it." : "Stored encrypted. It is never shown again."}
        >
          <input id="clientSecret" name="clientSecret" type="password" dir="ltr" autoComplete="off" required={!status.configured} className={inputClass} placeholder={status.configured ? "••••••••••••" : ""} />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="dark" disabled={saving}>
            {saving ? "Saving…" : "Save credentials"}
          </Button>
          {status.configured && (
            <Button type="button" onClick={connect} disabled={connecting}>
              {connecting ? "Opening Google…" : status.verifiedAt ? "Test again" : "Connect & test"}
            </Button>
          )}
        </div>
      </form>

      {status.configured && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-charcoal-900"
              checked={status.enabled}
              disabled={!status.verifiedAt || pending}
              onChange={(e) => run(() => setGoogleEnabledAction(e.target.checked))}
            />
            <span>
              Show “Continue with Google” on the login and registration pages
              {!status.verifiedAt && <span className="block text-xs text-muted">Available after a successful Connect &amp; test.</span>}
            </span>
          </label>
          {confirmRemove ? (
            <span className="flex items-center gap-2 text-sm">
              Remove Google credentials?
              <Button type="button" variant="dark" className="py-2" onClick={() => run(removeGoogleAction)} disabled={pending}>
                Yes, remove
              </Button>
              <Button type="button" variant="secondary" className="py-2" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <button type="button" className="text-sm text-red-700 underline-offset-4 hover:underline" onClick={() => setConfirmRemove(true)}>
              Disconnect Google
            </button>
          )}
        </div>
      )}
    </section>
  );
}
