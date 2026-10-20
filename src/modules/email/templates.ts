import type { Dictionary } from "@/i18n/dictionaries/en";
import { localeMeta, type Locale } from "@/i18n/config";
import { format } from "@/i18n/merge";
import type { Mail } from "@/lib/mailer";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Invisible bidi marks from dictionary fallbacks are not wanted in plain-text email.
const plain = (s: string) => s.replace(/[⁦-⁩]/g, "");

/** Branded, single-call-to-action transactional email (HTML + plain text). */
export function actionEmail(opts: {
  dict: Dictionary;
  locale: Locale;
  to: string;
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
  const greeting = format(e.greeting, { name: opts.name });
  const dir = localeMeta[locale].dir;
  const url = escapeHtml(opts.url);

  const html = `<!doctype html>
<html lang="${localeMeta[locale].htmlLang}" dir="${dir}">
<body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#2b323c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#2b323c;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">Digitals Minds
          <div style="color:#fdcf31;font-size:12px;font-weight:normal;margin-top:4px">Learn | Grow | Earn</div></td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6" dir="${dir}">
          <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;white-space:pre-line">${escapeHtml(opts.intro)}</p>
          <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#fdcf31;color:#2b323c;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${escapeHtml(opts.buttonLabel)}</a></p>
          <p style="margin:0 0 8px;color:#5f6675;font-size:13px">${escapeHtml(e.linkFallback)}</p>
          <p style="margin:0 0 24px;font-size:12px;word-break:break-all" dir="ltr"><a href="${url}" style="color:#2b323c">${url}</a></p>
          ${opts.ignoreNote === false ? "" : `<p style="margin:0;color:#5f6675;font-size:13px">${escapeHtml(e.ignore)}</p>`}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f6f7f9;color:#5f6675;font-size:12px">${escapeHtml(e.signature)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = plain([greeting, "", opts.intro, "", `${opts.buttonLabel}: ${opts.url}`, "", ...(opts.ignoreNote === false ? [] : [e.ignore, ""]), e.signature].join("\n"));
  return { to: opts.to, subject: plain(opts.subject), html, text };
}
