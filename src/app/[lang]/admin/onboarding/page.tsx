import type { Metadata } from "next";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { listItems, scopeOf, scopeOptions } from "@/modules/onboarding/service";
import { ArchiveItem, ItemForm } from "./OnboardingForms";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingAdminPage() {
  await requirePagePermission("onboarding.manage", "/admin/onboarding");
  const [items, scopes] = await Promise.all([listItems(), scopeOptions()]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Onboarding</h1>
        <p className="mt-1 text-muted">
          Checklist steps students complete after their enrollment is confirmed, for everyone, one program or one batch. When every required step is done the
          student becomes active. Steps &quot;confirmed by staff&quot; are ticked from the batch&apos;s student list.
        </p>
      </div>
      <section aria-labelledby="new-step" className="glass rounded-2xl p-6">
        <h2 id="new-step" className="mb-4 text-lg font-semibold text-charcoal-900">Add a step</h2>
        <ItemForm scopes={scopes} />
      </section>
      <section aria-labelledby="steps" className="space-y-3">
        <h2 id="steps" className="text-lg font-semibold text-charcoal-900">Steps ({items.length})</h2>
        {items.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">No steps yet. Without steps, students become active as soon as they open their portal.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="glass rounded-2xl p-5" aria-label={i.title}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal-900">{i.title}</p>
                    <p className="text-xs text-muted">
                      {i.batch ? `Batch: ${i.batch.name}` : i.course ? `Program: ${i.course.title}` : "All students"} · order {i.position} · done by {i._count.progress}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={i.required ? "warn" : "off"}>{i.required ? "Required" : "Optional"}</StatusBadge>
                    <StatusBadge tone="off">{i.studentCompletes ? "Student ticks" : "Staff confirm"}</StatusBadge>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Edit</summary>
                  <div className="mt-3">
                    <ItemForm id={i.id} scopes={scopes} value={{ scope: scopeOf(i), title: i.title, description: i.description ?? "", required: i.required, studentCompletes: i.studentCompletes, position: String(i.position) }} />
                  </div>
                </details>
                <div className="mt-3"><ArchiveItem id={i.id} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
