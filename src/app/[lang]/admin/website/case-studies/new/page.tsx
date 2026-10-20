import type { Metadata } from "next";
import Link from "next/link";
import { serviceSlugs } from "@/content/services";
import { requirePagePermission } from "@/modules/auth/session";
import { publicImages } from "@/modules/content/settings";
import { serviceLabel } from "@/modules/inquiries/labels";
import { CaseStudyForm } from "../../ItemForms";

export const metadata: Metadata = { title: "New case study" };

export default async function NewCaseStudyPage() {
  await requirePagePermission("content.manage", "/admin/website/case-studies/new");
  const images = await publicImages();
  return (
    <div className="space-y-4">
      <Link href="/admin/website/case-studies" className="text-sm text-muted hover:text-charcoal-900">← All case studies</Link>
      <section className="glass rounded-2xl p-6">
        <CaseStudyForm images={images} services={serviceSlugs.map((slug) => ({ slug, title: serviceLabel(slug) }))} />
      </section>
    </div>
  );
}
