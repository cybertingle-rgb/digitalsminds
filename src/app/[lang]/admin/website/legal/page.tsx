import type { Metadata } from "next";
import { requirePagePermission } from "@/modules/auth/session";
import { getLegalPage } from "@/modules/content/settings";
import { LegalForm } from "../WebsiteForms";

export const metadata: Metadata = { title: "Legal pages" };

const pages = [
  { key: "privacy" as const, label: "Privacy Policy", url: "/privacy" },
  { key: "terms" as const, label: "Terms & Conditions", url: "/terms" },
];

export default async function LegalSettingsPage() {
  await requirePagePermission("content.manage", "/admin/website/legal");
  const values = await Promise.all(pages.map((p) => getLegalPage(p.key)));
  return (
    <div className="space-y-6">
      {pages.map((p, i) => (
        <section key={p.key} aria-labelledby={`legal-${p.key}`} className="glass rounded-2xl p-6">
          <h2 id={`legal-${p.key}`} className="mb-4 flex flex-wrap items-center gap-3 text-lg font-semibold text-charcoal-900">
            {p.label}
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${values[i]?.published ? "bg-green-100 text-green-900" : "bg-charcoal-100 text-charcoal-700"}`}>
              {values[i]?.published ? "Published" : values[i] ? "Draft" : "Not written yet"}
            </span>
          </h2>
          <LegalForm page={p.key} url={p.url} value={values[i] ?? { title: p.label, body: "", published: false }} />
        </section>
      ))}
    </div>
  );
}
