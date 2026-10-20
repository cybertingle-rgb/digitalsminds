import type { Metadata } from "next";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { listTestimonials } from "@/modules/content/items";
import { publicImages } from "@/modules/content/settings";
import { ItemControls, TestimonialForm } from "../ItemForms";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requirePagePermission("content.manage", "/admin/website/testimonials");
  const [items, images] = await Promise.all([listTestimonials(), publicImages()]);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Only add real testimonials you have permission to publish. They appear on the homepage once published.</p>
      <ul className="space-y-3">
        {items.map((t, i) => (
          <li key={t.id}>
            <details className="glass rounded-2xl p-5">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="font-semibold text-charcoal-900" dir="auto">{t.name}{t.company ? `, ${t.company}` : ""}</span>
                <span className="flex gap-2">
                  {t.featured && <StatusBadge tone="warn">Shown first</StatusBadge>}
                  <StatusBadge tone={t.published ? "ok" : "off"}>{t.published ? "Published" : "Draft"}</StatusBadge>
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <ItemControls kind="testimonial" id={t.id} first={i === 0} last={i === items.length - 1} label={t.name} />
                <TestimonialForm item={t} images={images} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <section aria-labelledby="new-t" className="glass-subtle rounded-2xl border-dashed p-5">
        <h2 id="new-t" className="mb-4 font-semibold text-charcoal-900">Add a testimonial</h2>
        <TestimonialForm images={images} />
      </section>
    </div>
  );
}
