import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { courseStatusLabels, languageLabels } from "@/modules/courses/labels";
import { getCourseForEdit, pickableMedia, publishChecklist, publishWarnings } from "@/modules/courses/service";
import { listCategories, listServicesAdmin } from "@/modules/catalog/service";
import { formatDay } from "@/modules/batches/rules";
import { listBatches } from "@/modules/batches/service";
import { batchStatusLabels } from "@/modules/batches/labels";
import { mediaUrl } from "@/modules/media/service";
import { formatPkr } from "@/modules/payments/service";
import { DetailsForm, PriceForm, PublishPanel } from "../CourseForms";

export const metadata: Metadata = { title: "Edit program" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function EditCoursePage({ params }: PageProps<"/[lang]/admin/courses/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/courses/${id}`);
  const course = await getCourseForEdit(id, user);
  if (!course) notFound();
  const [media, batches, services, categories] = await Promise.all([pickableMedia(user), listBatches(user, { courseId: course.id }), listServicesAdmin(), listCategories()]);

  const images = media.filter((m) => m.visibility === "PUBLIC" && m.mimeType.startsWith("image/")).map((m) => ({ id: m.id, name: m.originalName, url: mediaUrl(m) }));
  // The current thumbnail stays selectable even if someone else uploaded it.
  if (course.thumbnail && !images.some((i) => i.id === course.thumbnail!.id)) {
    images.unshift({ id: course.thumbnail.id, name: course.thumbnail.originalName, url: mediaUrl(course.thumbnail) });
  }
  const objectives = Array.isArray(course.objectives) ? (course.objectives as unknown[]).filter((o): o is string => typeof o === "string") : [];
  const checklist = publishChecklist(course);

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-charcoal-900">← All programs</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{course.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge tone={course.status === "PUBLISHED" ? "ok" : course.status === "DRAFT" ? "warn" : "off"}>{courseStatusLabels[course.status]}</StatusBadge>
            <StatusBadge tone="off">{languageLabels[course.language]}</StatusBadge>
            {course.publishedAt && <span>First published {dateFmt.format(course.publishedAt)}</span>}
            <span>· {course._count.enrollments} {course._count.enrollments === 1 ? "student" : "students"}</span>
          </div>
        </div>
        {course.status === "PUBLISHED" && (
          <Link href={`/courses/${course.slug}`} className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-white/90">
            View public page
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section aria-labelledby="batches" className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="batches" className="text-lg font-semibold text-charcoal-900">Batches ({batches.length})</h2>
              {can(user.role, "batches.manage") && (
                <Link href={`/admin/batches/new?course=${course.id}`} className="text-sm font-semibold underline underline-offset-4">New batch</Link>
              )}
            </div>
            {batches.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No batches yet. Visitors can apply once a batch is open.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/batches/${b.id}`} className="font-medium text-charcoal-900 underline-offset-4 hover:underline">{b.name}</Link>
                    <span className="text-muted">starts {formatDay(b.startDate)} · {b.taken}/{b.capacity} seats · {batchStatusLabels[b.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="details" className="glass rounded-2xl p-6">
            <h2 id="details" className="mb-4 text-lg font-semibold text-charcoal-900">Program details</h2>
            <DetailsForm
              course={{
                id: course.id,
                title: course.title,
                titleUr: course.titleUr ?? "",
                slug: course.slug,
                slugLocked: !!course.publishedAt,
                language: course.language,
                summary: course.summary,
                summaryUr: course.summaryUr ?? "",
                description: course.description ?? "",
                objectives: objectives.join("\n"),
                prerequisites: course.prerequisites ?? "",
                level: course.level,
                durationText: course.durationText ?? "",
                format: course.format,
                thumbnailId: course.thumbnailId ?? "",
                serviceSlug: course.serviceSlug ?? "",
                categoryId: course.categoryId ?? "",
                certificateEnabled: course.certificateEnabled,
                seoTitle: course.seoTitle ?? "",
                seoDescription: course.seoDescription ?? "",
              }}
              images={images}
              services={services.map((s) => ({ slug: s.slug, title: s.title }))}
              categories={categories.map((c) => ({ id: c.id, title: c.title }))}
            />
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="publish" className="glass rounded-2xl p-6">
            <h2 id="publish" className="mb-4 text-lg font-semibold text-charcoal-900">Publishing</h2>
            <PublishPanel
              courseId={course.id}
              status={course.status}
              canPublish={can(user.role, "courses.publish")}
              checklist={checklist}
              warnings={publishWarnings(course)}
              deletable={course.status === "DRAFT" && course._count.enrollments === 0 && course._count.certificates === 0 && course._count.batches === 0 && course._count.applications === 0}
              enrollments={course._count.enrollments}
            />
          </section>

          <section aria-labelledby="price" className="glass rounded-2xl p-6">
            <h2 id="price" className="mb-4 text-lg font-semibold text-charcoal-900">Enrollment fee</h2>
            {can(user.role, "payments.manage") ? (
              <PriceForm courseId={course.id} paid={course.accessType === "PAID"} pricePkr={course.priceAmount ? course.priceAmount / 100 : null} />
            ) : (
              <p className="text-sm text-charcoal-800">
                {course.accessType === "PAID" && course.priceAmount ? formatPkr(course.priceAmount) : "Not set"}
                <span className="block text-muted">Only a Super Admin can change the fee.</span>
              </p>
            )}
          </section>

          {course.serviceSlug && <p className="text-xs text-muted">Related service: {services.find((s) => s.slug === course.serviceSlug)?.title ?? course.serviceSlug}</p>}
        </aside>
      </div>
    </div>
  );
}
