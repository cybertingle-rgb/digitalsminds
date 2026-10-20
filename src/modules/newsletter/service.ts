import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { actionEmail } from "@/modules/email/templates";

/**
 * Newsletter sign-up with email confirmation (double opt-in). A pending
 * sign-up lives in the Verification table (keyed by a hash of the emailed
 * token) and only becomes a NewsletterSubscriber once confirmed.
 */

const PENDING_PREFIX = "newsletter:";
const CONFIRM_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RESEND_AFTER_MS = 10 * 60 * 1000;

export const signupInput = z.object({
  email: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  locale: z.enum(["en", "ur"]).catch("en"),
  source: z.string().max(200).optional().catch(undefined),
});

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const pendingValue = z.object({ email: z.string(), locale: z.enum(["en", "ur"]), source: z.string().nullable() });

/** Always "ok" for valid input, so the form never reveals who is subscribed. */
export async function requestSubscription(input: z.infer<typeof signupInput>) {
  const existing = await db().newsletterSubscriber.findUnique({ where: { email: input.email } });
  if (existing?.status === "SUBSCRIBED") return;
  const identifier = `${PENDING_PREFIX}${input.email}`;
  const recent = await db().verification.findFirst({ where: { identifier, createdAt: { gt: new Date(Date.now() - RESEND_AFTER_MS) } } });
  if (recent) return;
  await db().verification.deleteMany({ where: { identifier } });
  const token = randomBytes(32).toString("base64url");
  await db().verification.create({
    data: {
      id: hash(token),
      identifier,
      value: JSON.stringify({ email: input.email, locale: input.locale, source: input.source ?? null }),
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    },
  });
  const locale: Locale = input.locale;
  const dict = getDictionary(locale);
  await sendMail(
    actionEmail({
      dict,
      locale,
      to: input.email,
      name: input.email,
      subject: dict.emails.newsletterSubject,
      intro: dict.emails.newsletterIntro,
      buttonLabel: dict.emails.newsletterButton,
      url: `${siteConfig.url}${localizePath("/newsletter/confirm", locale)}?token=${token}`,
    }),
  );
}

async function pendingFor(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const row = await db().verification.findUnique({ where: { id: hash(token) } });
  if (!row || !row.identifier.startsWith(PENDING_PREFIX) || row.expiresAt < new Date()) return null;
  const parsed = pendingValue.safeParse(JSON.parse(row.value));
  return parsed.success ? { row, ...parsed.data } : null;
}

/** For the confirm page (shows the address before the visitor confirms). */
export async function pendingEmail(token: string) {
  return (await pendingFor(token))?.email ?? null;
}

export async function confirmSubscription(token: string) {
  const p = await pendingFor(token);
  if (!p) return false;
  const now = new Date();
  await db().$transaction([
    db().newsletterSubscriber.upsert({
      where: { email: p.email },
      create: { email: p.email, locale: p.locale, source: p.source, consentAt: now, unsubscribeToken: randomBytes(32).toString("base64url") },
      update: { status: "SUBSCRIBED", locale: p.locale, source: p.source, consentAt: now, unsubscribedAt: null },
    }),
    db().verification.deleteMany({ where: { identifier: p.row.identifier } }),
  ]);
  return true;
}

export function subscriberByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return Promise.resolve(null);
  return db().newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
}

export async function unsubscribe(token: string) {
  const sub = await subscriberByToken(token);
  if (!sub) return false;
  if (sub.status !== "UNSUBSCRIBED") {
    await db().newsletterSubscriber.update({ where: { id: sub.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
  }
  return true;
}

/** Link to put in every newsletter email (when sending starts). */
export function unsubscribeUrl(token: string, locale: Locale = "en") {
  return `${siteConfig.url}${localizePath("/newsletter/unsubscribe", locale)}?token=${token}`;
}

// --- Admin --------------------------------------------------------------------

export function listSubscribers(opts: { q?: string; status?: "SUBSCRIBED" | "UNSUBSCRIBED"; take?: number }) {
  return db().newsletterSubscriber.findMany({
    where: { ...(opts.q ? { email: { contains: opts.q.toLowerCase() } } : {}), ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 200,
  });
}

export async function subscriberCounts() {
  const rows = await db().newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } });
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  return { subscribed: by.SUBSCRIBED ?? 0, unsubscribed: by.UNSUBSCRIBED ?? 0 };
}

export async function deleteSubscriber(id: string) {
  await db().newsletterSubscriber.delete({ where: { id } });
}
