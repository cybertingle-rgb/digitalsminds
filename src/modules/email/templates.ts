import type { Dictionary } from "@/i18n/dictionaries/en";
import { localeMeta, type Locale } from "@/i18n/config";
import { format } from "@/i18n/merge";
import type { Mail } from "@/lib/mailer";
import { brand, siteConfig } from "@/config/site";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Invisible bidi marks from dictionary fallbacks are not wanted in plain-text email.
const plain = (s: string) => s.replace(/[⁦-⁩]/g, "");

/** Branded, single-call-to-action transactional email (HTML + plain text). */
export function actionEmail(opts: {
  dict: Dictionary;
  locale: Locale;
  to: string;
  /** Empty: a greeting without a name. */
  name: string;
  subject: string;
  intro: string;
  buttonLabel: string;
  url: string;
  /** Show "if you didn't request this, ignore it" (default). Off for announcements and replies. */
  ignoreNote?: boolean;
}): Mail {
  const { dict, locale } = opts;
  const e = dict.emails;
  const greeting = opts.name.trim() ? format(e.greeting, { name: opts.name }) : e.greetingNoName;
  const dir = localeMeta[locale].dir;
  const url = escapeHtml(opts.url);
  // The official white-lettering logo, served by the site (alt text shows when images are blocked).
  const logoUrl = escapeHtml(`${siteConfig.url}${siteConfig.logo.dark.src}`);

  const html = `<!doctype html>
<html lang="${localeMeta[locale].htmlLang}" dir="${dir}">
<body style="margin:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#000000;padding:22px 28px;border-bottom:3px solid #ff741f"><img src="${logoUrl}" alt="${brand.name}" width="185" height="36" style="display:block;border:0;height:36px;width:185px;color:#ffffff;font-size:20px;font-weight:bold"></td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6" dir="${dir}">
          <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;white-space:pre-line">${escapeHtml(opts.intro)}</p>
          <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#ff741f;color:#000000;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${escapeHtml(opts.buttonLabel)}</a></p>
          <p style="margin:0 0 8px;color:#5c5c5c;font-size:13px">${escapeHtml(e.linkFallback)}</p>
          <p style="margin:0 0 24px;font-size:12px;word-break:break-all" dir="ltr"><a href="${url}" style="color:#111111">${url}</a></p>
          ${opts.ignoreNote === false ? "" : `<p style="margin:0;color:#5c5c5c;font-size:13px">${escapeHtml(e.ignore)}</p>`}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f7f7f7;color:#5c5c5c;font-size:12px">${escapeHtml(e.signature)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = plain([greeting, "", opts.intro, "", `${opts.buttonLabel}: ${opts.url}`, "", ...(opts.ignoreNote === false ? [] : [e.ignore, ""]), e.signature].join("\n"));
  return { to: opts.to, subject: plain(opts.subject), html, text };
}
