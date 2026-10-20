import type { Metadata } from "next";
import { StatusBadge } from "@/components/admin/ui";
import { getDictionary } from "@/i18n/get-dictionary";
import { requirePagePermission } from "@/modules/auth/session";
import { listFaqs } from "@/modules/content/items";
import { FaqForm, ImportFaqs, ItemControls } from "../ItemForms";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requirePagePermission("content.manage", "/admin/website/faqs");
  const faqs = await listFaqs();
  return (
    <div className="space-y-5">
      {faqs.length === 0 && <ImportFaqs count={getDictionary("en").home.faq.length} />}
      <ul className="space-y-3">
        {faqs.map((f, i) => (
          <li key={f.id}>
            <details className="glass rounded-2xl p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="font-semibold text-charcoal-900" dir="auto">{f.question}</span>
                <StatusBadge tone={f.published ? "ok" : "off"}>{f.published ? "Published" : "Draft"}</StatusBadge>
              </summary>
              <div className="mt-4 space-y-4">
                <ItemControls kind="faq" id={f.id} first={i === 0} last={i === faqs.length - 1} label={f.question} />
                <FaqForm faq={f} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section aria-labelledby="new-faq" className="glass-subtle rounded-2xl border-dashed p-5">
        <h2 id="new-faq" className="mb-4 font-semibold text-charcoal-900">Add a question</h2>
        <FaqForm />
      </section>
    </div>
  );
}
