import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { listServicesAdmin } from "@/modules/catalog/service";

export const metadata: Metadata = { title: "Services" };

const statusLabel = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" } as const;

export default async function ServicesAdminPage() {
  await requirePagePermission("content.manage", "/admin/services");
  const services = await listServicesAdmin();
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Services</h1>
          <p className="mt-1 text-muted">
            Professional services visitors can inquire about without an account. Published services appear on the Services page, the home page, the footer and the
            contact form&apos;s topic list. Inquiries arrive in Inquiries.
          </p>
        </div>
        <Link href="/admin/services/new" className="rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal-800">New service</Link>
      </div>
      <ul className="space-y-3">
        {services.map((s) => (
          <li key={s.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
            <div className="min-w-0">
              <Link href={`/admin/services/${s.id}`} className="font-semibold text-charcoal-900 hover:underline">{s.title}</Link>
              <p className="text-xs text-muted">/services/{s.slug} · {s.category?.title ?? "No category"} · order {s.sortOrder}</p>
            </div>
            <StatusBadge tone={s.status === "PUBLISHED" ? "ok" : s.status === "DRAFT" ? "warn" : "off"}>{statusLabel[s.status]}</StatusBadge>
          </li>
        ))}
      </ul>
    </div>
  );
}
