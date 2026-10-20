import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/Button";
import { requirePagePermission } from "@/modules/auth/session";
import { listCaseStudies } from "@/modules/content/items";
import { ItemControls } from "../ItemForms";

export const metadata: Metadata = { title: "Case studies" };

export default async function CaseStudiesAdminPage() {
  await requirePagePermission("content.manage", "/admin/website/case-studies");
  const items = await listCaseStudies();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Published case studies appear at /case-studies (and on the homepage).</p>
        <LinkButton href="/admin/website/case-studies/new" variant="dark" className="py-2">New case study</LinkButton>
      </div>
      {items.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-8 text-center text-muted">No case studies yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c, i) => (
            <li key={c.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
              <div className="min-w-0">
                <Link href={`/admin/website/case-studies/${c.id}`} className="font-semibold text-charcoal-900 hover:underline" dir="auto">{c.title}</Link>
                <p className="text-xs text-muted" dir="auto">{c.client ?? "No client name"} · /case-studies/{c.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone={c.published ? "ok" : "off"}>{c.published ? "Published" : "Draft"}</StatusBadge>
                <ItemControls kind="caseStudy" id={c.id} first={i === 0} last={i === items.length - 1} label={c.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
