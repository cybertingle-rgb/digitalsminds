import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/get-dictionary";
import { requirePagePermission } from "@/modules/auth/session";
import { getContactSetting } from "@/modules/content/settings";
import { getSocialLinks } from "@/modules/settings/social";
import { ContactForm } from "../WebsiteForms";
import { SocialForm } from "./SocialForm";

export const metadata: Metadata = { title: "Contact & social" };

export default async function ContactSettingsPage() {
  await requirePagePermission("content.manage", "/admin/website/contact");
  const dict = getDictionary("en");
  const [contact, links] = await Promise.all([getContactSetting(), getSocialLinks()]);
  return (
    <div className="space-y-6">
      <section aria-labelledby="contact" className="glass rounded-2xl p-6">
        <h2 id="contact" className="mb-4 text-lg font-semibold text-charcoal-900">Contact details</h2>
        <ContactForm value={contact ?? { email: siteConfig.contact.email, address: dict.contact.address, addressUr: [] }} />
      </section>
      <section aria-labelledby="social" className="glass rounded-2xl p-6">
        <h2 id="social" className="text-lg font-semibold text-charcoal-900">Social media links</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Shown as icons on the right side of every page (tablets and computers) and in the footer.</p>
        <SocialForm values={{ facebook: links.facebook ?? "", instagram: links.instagram ?? "", linkedin: links.linkedin ?? "" }} />
      </section>
    </div>
  );
}
