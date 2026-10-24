import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/modules/auth/session";
import { listCategories } from "@/modules/catalog/service";
import { emptyService, ServiceForm } from "../CatalogForms";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  await requirePagePermission("content.manage", "/admin/services/new");
  const categories = await listCategories();
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/services" className="text-sm text-muted hover:text-charcoal-900">← Services</Link>
      <h1 className="text-2xl font-bold text-charcoal-900">New service</h1>
      <section className="glass rounded-2xl p-6">
        <ServiceForm value={emptyService} categories={categories.map((c) => ({ id: c.id, title: c.title }))} />
      </section>
    </div>
  );
}
