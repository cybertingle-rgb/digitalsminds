import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig, type SmtpConfig } from "@/modules/settings/integrations";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email sending is not configured. Set it up in Admin → Integrations → Email.");
    this.name = "MailNotConfiguredError";
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
  await transport(config).sendMail({
    from: { name: config.fromName, address: config.fromEmail },
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

/** Checks the SMTP login without sending anything. */
export async function verifySmtp(cfg: SmtpConfig) {
  await transport(cfg).verify();
}
