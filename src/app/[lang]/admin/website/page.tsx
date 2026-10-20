import type { Metadata } from "next";
import { requirePagePermission } from "@/modules/auth/session";
import { getSocialLinks } from "@/modules/settings/social";
import { SocialForm } from "./SocialForm";

export const metadata: Metadata = { title: "Website" };

export default async function WebsitePage() {
  await requirePagePermission("content.manage", "/admin/website");
  const links = await getSocialLinks();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Website</h1>
        <p className="mt-1 text-muted">Settings for the public website. More (homepage, FAQs, testimonials, legal pages) arrive with content management.</p>
      </div>
      <section aria-labelledby="social" className="glass rounded-2xl p-6">
        <h2 id="social" className="text-lg font-semibold text-charcoal-900">Social media links</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Shown as icons on the right side of every page (tablets and computers) and in the footer.</p>
        <SocialForm values={{ facebook: links.facebook ?? "", instagram: links.instagram ?? "", linkedin: links.linkedin ?? "" }} />
      </section>
    </div>
  );
}
