import "server-only";
import { z } from "zod";
import { serviceSlugs } from "@/content/services";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { slugify, slugSchema } from "@/modules/courses/schema";

/**
 * FAQs, testimonials and case studies (Admin → Website). Each has a
 * draft/published switch; order is set with up/down moves.
 */

export class ContentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ContentError";
  }
}

const text = (max: number) => z.string().trim().max(max);
const opt = (max: number) => text(max).optional().transform((v) => (v ? v : null));

// --- FAQs ----------------------------------------------------------------------------

export const faqInput = z.object({
  question: text(300).min(5, "Write the question"),
  questionUr: opt(300),
  answer: text(5000).min(5, "Write the answer"),
  answerUr: opt(5000),
  published: z.boolean(),
});

export function listFaqs() {
  return db().faq.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

async function nextPosition(model: "faq" | "testimonial" | "caseStudy") {
  const agg =
    model === "faq"
      ? await db().faq.aggregate({ _max: { position: true } })
      : model === "testimonial"
        ? await db().testimonial.aggregate({ _max: { position: true } })
        : await db().caseStudy.aggregate({ _max: { position: true } });
  return (agg._max.position ?? -1) + 1;
}

export async function createFaq(input: z.infer<typeof faqInput>, actorId: string) {
  const faq = await db().faq.create({ data: { ...input, position: await nextPosition("faq") } });
  await audit({ actorId, action: "content.faq_saved", entityType: "Faq", entityId: faq.id });
  return faq;
}

export async function updateFaq(id: string, input: z.infer<typeof faqInput>, actorId: string) {
  await db().faq.update({ where: { id }, data: input });
  await audit({ actorId, action: "content.faq_saved", entityType: "Faq", entityId: id });
}

export async function deleteFaq(id: string, actorId: string) {
  await db().faq.delete({ where: { id } });
  await audit({ actorId, action: "content.faq_deleted", entityType: "Faq", entityId: id });
}

/** Copies the built-in FAQ text into the database so it can be edited (only when there are none yet). */
export async function importDefaultFaqs(dict: Dictionary, actorId: string) {
  if ((await db().faq.count()) > 0) throw new ContentError("FAQs were already imported.");
  await db().faq.createMany({ data: dict.home.faq.map((f, i) => ({ question: f.q, answer: f.a, position: i, published: true })) });
  await audit({ actorId, action: "content.faq_imported", entityType: "Faq", metadata: { count: dict.home.faq.length } });
}

/**
 * FAQs for the website: published ones from the database, or the built-in
 * list until FAQs have been imported/created in the admin.
 */
export async function publicFaqs(locale: Locale, dict: Dictionary) {
  try {
    const all = await db().faq.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    if (all.length === 0) return dict.home.faq;
    return all
      .filter((f) => f.published)
      .map((f) => ({ q: (locale === "ur" && f.questionUr) || f.question, a: (locale === "ur" && f.answerUr) || f.answer }));
  } catch {
    return dict.home.faq;
  }
}

// --- Testimonials ------------------------------------------------------------------------

export const testimonialInput = z
  .object({
    name: text(120).min(2, "Enter the person's name"),
    roleTitle: opt(160),
    company: opt(160),
    quote: text(2000).min(10, "Paste what they said"),
    quoteUr: opt(2000),
    photoId: z.string().max(64).optional().transform((v) => v || null),
    consentConfirmed: z.boolean(),
    published: z.boolean(),
    featured: z.boolean(),
  })
  .refine((v) => !v.published || v.consentConfirmed, { path: ["consentConfirmed"], message: "Confirm you have the person's permission before publishing" });

export function listTestimonials() {
  return db().testimonial.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { photo: true } });
}

async function assertPublicImage(id: string | null, field: string) {
  if (!id) return;
  const a = await db().mediaAsset.findUnique({ where: { id } });
  if (!a || a.visibility !== "PUBLIC" || !a.mimeType.startsWith("image/")) {
    throw new z.ZodError([{ code: "custom", path: [field], message: "Choose a public image from the Media library", input: id }]);
  }
}

export async function saveTestimonial(id: string | null, input: z.infer<typeof testimonialInput>, actorId: string) {
  await assertPublicImage(input.photoId, "photoId");
  const t = id
    ? await db().testimonial.update({ where: { id }, data: input })
    : await db().testimonial.create({ data: { ...input, position: await nextPosition("testimonial") } });
  await audit({ actorId, action: "content.testimonial_saved", entityType: "Testimonial", entityId: t.id, metadata: { published: input.published } });
  return t;
}

export async function deleteTestimonial(id: string, actorId: string) {
  await db().testimonial.delete({ where: { id } });
  await audit({ actorId, action: "content.testimonial_deleted", entityType: "Testimonial", entityId: id });
}

// --- Case studies ---------------------------------------------------------------------------

export const caseStudyInput = z
  .object({
    title: text(200).min(3, "Enter a title"),
    titleUr: opt(200),
    slug: z.string().trim().transform((v) => v.toLowerCase()).pipe(z.union([z.literal(""), slugSchema])),
    client: opt(160),
    summary: text(500).min(10, "Write a short summary"),
    summaryUr: opt(500),
    body: text(100_000).min(20, "Write the case study"),
    bodyUr: opt(100_000),
    serviceSlug: z.enum([...serviceSlugs, ""] as [string, ...string[]]).transform((v) => v || null),
    coverImageId: z.string().max(64).optional().transform((v) => v || null),
    consentConfirmed: z.boolean(),
    published: z.boolean(),
  })
  .refine((v) => !v.published || v.consentConfirmed, { path: ["consentConfirmed"], message: "Confirm the client agreed to be featured before publishing" });

export function listCaseStudies() {
  return db().caseStudy.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { coverImage: true } });
}

export function getCaseStudy(id: string) {
  return db().caseStudy.findUnique({ where: { id } });
}

export async function saveCaseStudy(id: string | null, input: z.infer<typeof caseStudyInput>, actorId: string) {
  await assertPublicImage(input.coverImageId, "coverImageId");
  const slug = input.slug || slugify(input.title) || `case-study-${Date.now().toString(36)}`;
  const clash = await db().caseStudy.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another case study already uses this web address", input: slug }]);
  const data = { ...input, slug };
  const c = id ? await db().caseStudy.update({ where: { id }, data }) : await db().caseStudy.create({ data: { ...data, position: await nextPosition("caseStudy") } });
  await audit({ actorId, action: "content.case_study_saved", entityType: "CaseStudy", entityId: c.id, metadata: { title: c.title, published: c.published } });
  return c;
}

export async function deleteCaseStudy(id: string, actorId: string) {
  const c = await db().caseStudy.delete({ where: { id } });
  await audit({ actorId, action: "content.case_study_deleted", entityType: "CaseStudy", entityId: id, metadata: { title: c.title } });
}

export async function publishedCaseStudies() {
  try {
    return await db().caseStudy.findMany({
      where: { published: true, consentConfirmed: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      include: { coverImage: true },
    });
  } catch {
    return [];
  }
}

export async function caseStudyBySlug(slug: string) {
  try {
    return await db().caseStudy.findFirst({ where: { slug, published: true, consentConfirmed: true }, include: { coverImage: true } });
  } catch {
    return null;
  }
}

// --- Ordering (shared) -------------------------------------------------------------------------

export async function moveItem(kind: "faq" | "testimonial" | "caseStudy", id: string, direction: "up" | "down") {
  const rows =
    kind === "faq"
      ? await db().faq.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } })
      : kind === "testimonial"
        ? await db().testimonial.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } })
        : await db().caseStudy.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const ids = rows.map((r) => r.id);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  // Renumber everything so positions stay unique and gap-free.
  await db().$transaction(
    ids.map((rowId, position) =>
      kind === "faq"
        ? db().faq.update({ where: { id: rowId }, data: { position } })
        : kind === "testimonial"
          ? db().testimonial.update({ where: { id: rowId }, data: { position } })
          : db().caseStudy.update({ where: { id: rowId }, data: { position } }),
    ),
  );
}
