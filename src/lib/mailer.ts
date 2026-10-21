import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "@/modules/settings/integrations";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not configured. Set it up in Admin → Integrations → Email.");
    this.name = "MailNotConfiguredError";
  }
}

/** Plain-language reason for an SMTP failure (nodemailer error codes). */
export function mailErrorMessage(e: unknown): string {
  if (e instanceof MailNotConfiguredError) return "Email sending is not set up (or the saved mailbox password needs re-entering) in Admin → Integrations → Email.";
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "EAUTH":
      return "The mail server rejected the login. Check the mailbox address and password.";
    case "ECONNECTION":
    case "ETIMEDOUT":
    case "EDNS":
      return "Could not reach the mail server. Check the host name and port.";
    case "ESOCKET":
    case "ETLS":
      return "Security setting mismatch. Use SSL with port 465, or turn SSL off for port 587.";
    case "EENVELOPE":
      return "The mail server refused the recipient or sender address.";
    default:
      return "The mail server returned an error. Check all settings and try again.";
  }
}

function transport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure,
    auth: { user: cfg.username, pass: cfg.password },
    // Defence in depth: messages never read local files or fetch URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

export type Mail = { to: string; subject: string; html: string; text: string };

export async function sendMail(mail: Mail, cfg?: SmtpConfig | null) {
  const config = cfg ?? (await getSmtpConfig());
  if (!config) throw new MailNotConfiguredError();
  const message = {
    from: { name: config.fromName, address: config.fromEmail },
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  };
  try {
    await transport(config).sendMail(message);
  } catch (e) {
    // The mail server sometimes doesn't answer a connection in time; one retry usually gets through.
    if (!RETRYABLE.has((e as { code?: string })?.code ?? "")) throw e;
    console.warn("[mail] connection failed, retrying once:", (e as Error).message);
    await new Promise((r) => setTimeout(r, 1500));
    await transport(config).sendMail(message);
  }
}

/** Failures before the message was handed over, so retrying can't send it twice. */
const RETRYABLE = new Set(["ECONNECTION", "EDNS", "ETIMEDOUT"]);

/** Checks the SMTP login without sending anything. */
export async function verifySmtp(cfg: SmtpConfig) {
  await transport(cfg).verify();
}
