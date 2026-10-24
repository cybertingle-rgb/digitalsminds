import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/modules/auth/session";
import { listCategories, serviceById, stringList } from "@/modules/catalog/service";
import { DeleteService, ServiceForm } from "../CatalogForms";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/[lang]/admin/services/[id]">) {
  const { id } = await params;
  await requirePagePermission("content.manage", `/admin/services/${id}`);
  const [s, categories] = await Promise.all([serviceById(id), listCategories()]);
  if (!s) notFound();
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/services" className="text-sm text-muted hover:text-charcoal-900">← Services</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-charcoal-900">{s.title}</h1>
        {s.status === "PUBLISHED" && (
          <Link href={`/services/${s.slug}`} className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-white/90">View public page</Link>
        )}
      </div>
      <section className="glass rounded-2xl p-6">
        <ServiceForm
          id={s.id}
          categories={categories.map((c) => ({ id: c.id, title: c.title }))}
          value={{
            slug: s.slug,
            title: s.title,
            shortTitle: s.shortTitle ?? "",
            summary: s.summary,
            description: s.description ?? "",
            offerings: stringList(s.offerings).join("\n"),
            idealFor: stringList(s.idealFor).join("\n"),
            notice: s.notice ?? "",
            categoryId: s.categoryId ?? "",
            sortOrder: String(s.sortOrder),
            status: s.status,
            seoTitle: s.seoTitle ?? "",
            seoDescription: s.seoDescription ?? "",
          }}
        />
      </section>
      <DeleteService id={s.id} />
    </div>
  );
}
