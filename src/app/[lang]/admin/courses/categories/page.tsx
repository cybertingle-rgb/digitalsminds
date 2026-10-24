import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { listCategories } from "@/modules/catalog/service";
import { CategoryForm, DeleteCategory, emptyCategory } from "../../services/CatalogForms";

export const metadata: Metadata = { title: "Program categories" };

export default async function CategoriesPage() {
  await requirePagePermission("courses.manage.all", "/admin/courses/categories");
  const categories = await listCategories();
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-charcoal-900">← Programs</Link>
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Program categories</h1>
        <p className="mt-1 text-muted">
          Group programs and services, e.g. marketplace training or AI &amp; automation. Categories with published programs become filters on the Programs page, and a
          category&apos;s notice is shown on each of its program and service pages.
        </p>
      </div>
      <section aria-labelledby="new-category" className="glass rounded-2xl p-6">
        <h2 id="new-category" className="mb-4 text-lg font-semibold text-charcoal-900">Add a category</h2>
        <CategoryForm value={emptyCategory} />
      </section>
      <ul className="space-y-3">
        {categories.map((c) => (
          <li key={c.id} className="glass rounded-2xl p-5" aria-label={c.title}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold text-charcoal-900">{c.title}</span>
                  <span className="block text-xs text-muted">{c._count.courses} programs · {c._count.services} services · order {c.sortOrder}</span>
                </span>
                <StatusBadge tone={c.active ? "ok" : "off"}>{c.active ? "Shown" : "Hidden"}</StatusBadge>
              </summary>
              <div className="mt-4 space-y-3 border-t border-white/70 pt-4">
                <CategoryForm
                  id={c.id}
                  value={{ slug: c.slug, title: c.title, titleUr: c.titleUr ?? "", summary: c.summary ?? "", summaryUr: c.summaryUr ?? "", notice: c.notice ?? "", sortOrder: String(c.sortOrder), active: c.active }}
                />
                <DeleteCategory id={c.id} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
