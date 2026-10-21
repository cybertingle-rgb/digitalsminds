import type { Metadata } from "next";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { listDocuments, scopeOptions } from "@/modules/onboarding/service";
import { DocumentActions, UploadDocument } from "./DocumentForms";

export const metadata: Metadata = { title: "Documents" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default async function DocumentsAdminPage() {
  await requirePagePermission("onboarding.manage", "/admin/documents");
  const [docs, scopes] = await Promise.all([listDocuments(), scopeOptions()]);
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Documents</h1>
        <p className="mt-1 text-muted">Forms, policies and onboarding material for students. Files are private: only the students they&apos;re for (and staff) can download them.</p>
      </div>
      <section aria-labelledby="upload" className="glass rounded-2xl p-6">
        <h2 id="upload" className="mb-4 text-lg font-semibold text-charcoal-900">Upload a document</h2>
        <UploadDocument scopes={scopes} />
      </section>
      <section aria-labelledby="docs" className="space-y-3">
        <h2 id="docs" className="text-lg font-semibold text-charcoal-900">Documents ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">No documents yet.</p>
        ) : (
          <ul className="glass divide-y divide-charcoal-200/50 rounded-2xl">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-5" aria-label={d.title}>
                <div className="min-w-0">
                  <a href={`/api/documents/${d.id}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">{d.title}</a>
                  {d.description && <p className="text-sm text-charcoal-800">{d.description}</p>}
                  <p className="text-xs text-muted">
                    {d.batch ? `Batch: ${d.batch.name}` : d.course ? `Program: ${d.course.title}` : "All students"} · {d.fileName} · {size(d.sizeBytes)} · {dateFmt.format(d.createdAt)}
                    {d.uploadedBy && ` · ${d.uploadedBy.name}`}
                  </p>
                  <div className="mt-2"><DocumentActions id={d.id} published={d.published} /></div>
                </div>
                <StatusBadge tone={d.published ? "ok" : "off"}>{d.published ? "Visible" : "Hidden"}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
