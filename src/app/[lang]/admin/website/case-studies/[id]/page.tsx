import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/modules/auth/session";
import { getCaseStudy } from "@/modules/content/items";
import { publicImages } from "@/modules/content/settings";
import { listServicesAdmin } from "@/modules/catalog/service";
import { CaseStudyForm } from "../../ItemForms";

export const metadata: Metadata = { title: "Edit case study" };

export default async function EditCaseStudyPage({ params }: PageProps<"/[lang]/admin/website/case-studies/[id]">) {
  const { id } = await params;
  await requirePagePermission("content.manage", `/admin/website/case-studies/${id}`);
  const [item, images, services] = await Promise.all([getCaseStudy(id), publicImages(), listServicesAdmin()]);
  if (!item) notFound();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/website/case-studies" className="text-sm text-muted hover:text-charcoal-900">← All case studies</Link>
        {item.published && <a href={`/case-studies/${item.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">View on website</a>}
      </div>
      <section className="glass rounded-2xl p-6">
        <CaseStudyForm item={item} images={images} services={services.map((s) => ({ slug: s.slug, title: s.title }))} />
      </section>
    </div>
  );
}
