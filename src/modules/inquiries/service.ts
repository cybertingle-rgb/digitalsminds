import "server-only";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { sendLeadAlert } from "./alerts";
import type { InquiryInput } from "./schema";

export async function createInquiry(input: InquiryInput) {
  const inquiry = await db().inquiry.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      service: input.service,
      message: input.message,
      source: input.source,
      locale: input.locale,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
    },
    select: { id: true, createdAt: true },
  });

  await sendLeadAlert(inquiry.id, input);

  await notifyWebhook({
    id: inquiry.id,
    createdAt: inquiry.createdAt.toISOString(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    service: input.service,
    message: input.message,
    source: input.source,
    locale: input.locale,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
  });
  return inquiry;
}

/**
 * Optional outbound notification (Zapier, Make, Slack, CRM). Failures are
 * logged but never fail the request: the lead is already saved.
 */
async function notifyWebhook(payload: Record<string, unknown>) {
  const url = serverEnv().INQUIRY_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "inquiry.created", data: payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[inquiries] webhook responded ${res.status}`);
  } catch (err) {
    console.warn("[inquiries] webhook failed", err);
  }
}
