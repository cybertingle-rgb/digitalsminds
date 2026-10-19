import "server-only";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { actionEmail } from "@/modules/email/templates";
import { serviceLabel } from "./labels";
import type { InquiryInput } from "./schema";

/** Where "new inquiry" alert emails go (Admin → Inquiries → Alert settings). */
const KEY = "notifications.inquiry";
const settingSchema = z.object({ enabled: z.boolean(), email: z.email() });
export type LeadAlertSetting = z.infer<typeof settingSchema>;

export async function getLeadAlertSetting(): Promise<LeadAlertSetting> {
  const row = await db().siteSetting.findUnique({ where: { key: KEY } });
  const parsed = settingSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : { enabled: true, email: siteConfig.contact.email };
}

export async function saveLeadAlertSetting(value: LeadAlertSetting, actorId: string) {
  await db().siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: actorId }, update: { value, updatedById: actorId } });
}

/** Best effort: a lead is already saved, so a mail problem is only logged. */
export async function sendLeadAlert(id: string, input: InquiryInput) {
  try {
    const setting = await getLeadAlertSetting();
    if (!setting.enabled) return;
    const dict = getDictionary("en");
    const excerpt = input.message.length > 400 ? `${input.message.slice(0, 400)}…` : input.message;
    await sendMail(
      actionEmail({
        dict,
        locale: "en",
        to: setting.email,
        name: "Digitals Minds team",
        subject: `New inquiry: ${serviceLabel(input.service)} from ${input.name}`,
        intro: `${input.name} (${input.email}) sent an inquiry about ${serviceLabel(input.service)}: “${excerpt}”`,
        buttonLabel: "Open the inquiry",
        url: `${siteConfig.url}/admin/inquiries/${id}`,
      }),
    );
  } catch (err) {
    console.warn("[inquiries] lead alert not sent:", err instanceof Error ? err.message : err);
  }
}
