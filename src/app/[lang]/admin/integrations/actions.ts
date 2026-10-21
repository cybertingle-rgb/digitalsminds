"use server";

import { revalidatePath } from "next/cache";
import { invalidateAuth } from "@/lib/auth";
import { mailErrorMessage, sendMail, verifySmtp } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import {
  getSmtpConfig,
  getSmtpStatus,
  UNREADABLE_SMTP,
  googleCredentialsInput,
  markSmtpVerified,
  removeGoogle,
  saveGoogleCredentials,
  saveSmtp,
  setGoogleEnabled,
  smtpInput,
} from "@/modules/settings/integrations";
import { runStorageCheck } from "@/modules/media/storage-check";

export type ActionState = { status: "idle" | "success" | "error"; message?: string; fields?: Record<string, string> };

const PATH = "/admin/integrations";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[String(i.path[0])] ??= i.message;
  return fields;
}

async function guard(): Promise<{ id: string; email: string } | ActionState> {
  try {
    return await assertPermission("integrations.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    throw e;
  }
}
const denied = (v: unknown): v is ActionState => typeof v === "object" && v !== null && "status" in v;

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export async function saveGoogleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  const parsed = googleCredentialsInput.safeParse({
    clientId: formData.get("clientId"),
    clientSecret: formData.get("clientSecret") || undefined,
  });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error.issues) };
  try {
    await saveGoogleCredentials(parsed.data, user.id);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not save" };
  }
  await audit({ actorId: user.id, action: "integration.google.saved", entityType: "Integration", entityId: "google", metadata: { clientId: parsed.data.clientId, secretChanged: !!parsed.data.clientSecret } });
  invalidateAuth();
  revalidatePath(PATH);
  return { status: "success", message: "Saved. Now click “Connect & test” to sign in with Google once and confirm it works." };
}

export async function setGoogleEnabledAction(enabled: boolean): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  try {
    await setGoogleEnabled(enabled, user.id);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not update" };
  }
  await audit({ actorId: user.id, action: enabled ? "integration.google.enabled" : "integration.google.disabled", entityType: "Integration", entityId: "google" });
  revalidatePath(PATH);
  return { status: "success", message: enabled ? "“Sign in with Google” is now shown to students." : "“Sign in with Google” is hidden." };
}

export async function removeGoogleAction(): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  await removeGoogle();
  await audit({ actorId: user.id, action: "integration.google.removed", entityType: "Integration", entityId: "google" });
  invalidateAuth();
  revalidatePath(PATH);
  return { status: "success", message: "Google disconnected and credentials deleted." };
}

// ---------------------------------------------------------------------------
// Email (SMTP)
// ---------------------------------------------------------------------------

export async function saveSmtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  const parsed = smtpInput.safeParse({
    host: formData.get("host"),
    port: formData.get("port"),
    secure: formData.get("secure") === "on",
    username: formData.get("username"),
    password: formData.get("password") || undefined,
    fromName: formData.get("fromName"),
    fromEmail: formData.get("fromEmail"),
  });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error.issues) };
  try {
    await saveSmtp(parsed.data, user.id);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not save" };
  }
  await audit({ actorId: user.id, action: "integration.smtp.saved", entityType: "Integration", entityId: "smtp", metadata: { host: parsed.data.host, port: parsed.data.port, username: parsed.data.username, passwordChanged: !!parsed.data.password } });
  revalidatePath(PATH);

  // Check the login straight away so problems show up now, not when a student registers.
  const cfg = await getSmtpConfig();
  if (!cfg) return { status: "error", message: UNREADABLE_SMTP };
  try {
    await verifySmtp(cfg);
  } catch (e) {
    return { status: "error", message: `Saved, but the connection test failed: ${mailErrorMessage(e)}` };
  }
  return { status: "success", message: "Saved and connected. Send a test email to finish." };
}

export async function sendTestEmailAction(): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  const cfg = await getSmtpConfig();
  if (!cfg) return { status: "error", message: (await getSmtpStatus()).configured ? UNREADABLE_SMTP : "Save the email settings first." };
  try {
    await sendMail(
      {
        to: user.email,
        subject: "Digitals Minds test email",
        text: "Email sending from the Digitals Minds website is working.",
        html: "<p>Email sending from the Digitals Minds website is working.</p>",
      },
      cfg,
    );
  } catch (e) {
    return { status: "error", message: mailErrorMessage(e) };
  }
  await markSmtpVerified(user.id);
  await audit({ actorId: user.id, action: "integration.smtp.tested", entityType: "Integration", entityId: "smtp" });
  revalidatePath(PATH);
  return { status: "success", message: `Test email sent to ${user.email}. Check the inbox (and spam folder).` };
}

// ---------------------------------------------------------------------------
// File storage
// ---------------------------------------------------------------------------

export async function runStorageCheckAction(): Promise<ActionState> {
  const user = await guard();
  if (denied(user)) return user;
  const status = await runStorageCheck();
  await audit({ actorId: user.id, action: "storage.checked", entityType: "Integration", entityId: "storage", metadata: { persistent: status.persistent, writable: status.writable } });
  revalidatePath(PATH);
  revalidatePath("/admin/media");
  if (status.problem) return { status: "error", message: status.problem };
  if (status.persistent) return { status: "success", message: "Confirmed: the upload folder survives redeploys. Uploads are on." };
  if (status.devMode) return { status: "success", message: "Development mode: uploads are on. On the live site, redeploy once and run the check again." };
  return { status: "success", message: "Marker created. Now redeploy the site in Hostinger, then run this check again." };
}
