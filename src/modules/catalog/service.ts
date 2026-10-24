import "server-only";
import { z } from "zod";
import { extraInquiryTopics, serviceSeeds } from "@/content/service-defaults";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { slugSchema } from "@/modules/courses/schema";

/**
 * The catalogue: program categories (Admin → Programs → Categories) and the
 * professional services visitors can inquire about (Admin → Services).
 */

export class CatalogError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CatalogError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

const text = (max: number) => z.string().trim().max(max);
const opt = (max: number) => text(max).optional().transform((v) => (v ? v : null));
/** One item per line -> array (bullets and blank lines dropped). */
const lines = (maxItems: number) =>
  z
    .string()
    .max(6000)
    .optional()
    .transform((v) => (v ?? "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean))
    .pipe(z.array(z.string().max(300, "Keep each line under 300 characters")).max(maxItems, `At most ${maxItems} lines`));

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categoryInput = z.object({
  slug: slugSchema,
  title: text(160).min(2, "Enter a name"),
  titleUr: opt(160),
  summary: opt(500),
  summaryUr: opt(500),
  notice: opt(3000),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  active: z.boolean(),
});

function assertCategories(actor: Actor) {
  if (!can(actor.role, "courses.manage.all")) throw new CatalogError("You don't have permission to manage categories.", 403);
}

export function listCategories(opts: { activeOnly?: boolean } = {}) {
  return db().programCategory.findMany({
    where: opts.activeOnly ? { active: true } : {},
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { _count: { select: { courses: true, services: true } } },
  });
}

export function categoryBySlug(slug: string) {
  return db().programCategory.findFirst({ where: { slug, active: true } });
}

async function slugTaken(model: "programCategory" | "service", slug: string, exceptId?: string) {
  const row = model === "service" ? await db().service.findUnique({ where: { slug } }) : await db().programCategory.findUnique({ where: { slug } });
  return !!row && row.id !== exceptId;
}

export async function saveCategory(id: string | null, input: z.infer<typeof categoryInput>, actor: Actor) {
  assertCategories(actor);
  if (await slugTaken("programCategory", input.slug, id ?? undefined)) throw new CatalogError("Another category already uses this web address.", 409);
  const row = id
    ? await db().programCategory.update({ where: { id }, data: input }).catch(() => null)
    : await db().programCategory.create({ data: input });
  if (!row) throw new CatalogError("Category not found.", 404);
  await audit({ actorId: actor.id, action: id ? "category.updated" : "category.created", entityType: "ProgramCategory", entityId: row.id, metadata: { title: row.title } });
  return row;
}

/** Programs and services in a deleted category simply become uncategorised. */
export async function deleteCategory(id: string, actor: Actor) {
  assertCategories(actor);
  const row = await db().programCategory.delete({ where: { id } }).catch(() => null);
  if (!row) throw new CatalogError("Category not found.", 404);
  await audit({ actorId: actor.id, action: "category.deleted", entityType: "ProgramCategory", entityId: id, metadata: { title: row.title } });
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const SEEDED_KEY = "catalog.servicesSeeded";

/**
 * Copies the starting services into the database once (so deleting one later
 * doesn't bring it back). Safe to call on every read; does nothing afterwards.
 */
export async function ensureServices() {
  try {
    if (await db().siteSetting.findUnique({ where: { key: SEEDED_KEY }, select: { key: true } })) return;
    const categories = new Set((await db().programCategory.findMany({ select: { id: true } })).map((c) => c.id));
    await db().service.createMany({
      data: serviceSeeds.map((s) => ({ ...s, categoryId: s.categoryId && categories.has(s.categoryId) ? s.categoryId : null, status: "PUBLISHED" as const })),
      skipDuplicates: true,
    });
    await db().siteSetting.upsert({ where: { key: SEEDED_KEY }, create: { key: SEEDED_KEY, value: { at: new Date().toISOString() } }, update: {} });
  } catch (err) {
    console.warn("[catalog] could not add the starting services:", err instanceof Error ? err.message : err);
  }
}

export async function publishedServices() {
  await ensureServices();
  try {
    return await db().service.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: { category: { select: { slug: true, title: true, titleUr: true } } },
    });
  } catch {
    return [];
  }
}

export type PublicService = Awaited<ReturnType<typeof publishedServices>>[number];

export async function publishedService(slug: string) {
  await ensureServices();
  return db().service.findFirst({ where: { slug, status: "PUBLISHED" }, include: { category: true } }).catch(() => null);
}

/** slug -> title for every service (drafts and archived too) plus the non-service inquiry topics. */
export async function inquiryTopicLabels(): Promise<Map<string, string>> {
  await ensureServices();
  const rows = await db().service.findMany({ select: { slug: true, title: true } }).catch(() => []);
  return new Map([...Object.entries(extraInquiryTopics), ...rows.map((r) => [r.slug, r.title] as [string, string])]);
}

/** A topic the inquiry form may send: a published service, or one of the fixed topics. */
export async function isInquiryTopic(slug: string) {
  if (slug in extraInquiryTopics) return true;
  await ensureServices();
  return !!(await db().service.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } }).catch(() => null));
}

export const serviceInput = z.object({
  slug: slugSchema,
  title: text(160).min(3, "Enter a name"),
  shortTitle: opt(80),
  summary: text(500).min(10, "Write a short summary"),
  description: opt(10000),
  offerings: lines(30),
  idealFor: lines(12),
  notice: opt(3000),
  categoryId: z.string().max(64).optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  seoTitle: opt(200),
  seoDescription: opt(320),
});

function assertServices(actor: Actor) {
  if (!can(actor.role, "content.manage")) throw new CatalogError("You don't have permission to manage services.", 403);
}

export async function listServicesAdmin() {
  await ensureServices();
  return db().service.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include: { category: { select: { title: true } } } });
}

export function serviceById(id: string) {
  return db().service.findUnique({ where: { id } });
}

export async function saveService(id: string | null, input: z.infer<typeof serviceInput>, actor: Actor) {
  assertServices(actor);
  if (await slugTaken("service", input.slug, id ?? undefined)) throw new CatalogError("Another service already uses this web address.", 409);
  if (input.categoryId && !(await db().programCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    throw new CatalogError("Choose an existing category.");
  }
  const row = id ? await db().service.update({ where: { id }, data: input }).catch(() => null) : await db().service.create({ data: input });
  if (!row) throw new CatalogError("Service not found.", 404);
  await audit({ actorId: actor.id, action: id ? "service.updated" : "service.created", entityType: "Service", entityId: row.id, metadata: { title: row.title, status: row.status } });
  return row;
}

/** Inquiries keep the slug as text, so deleting a service never touches them. */
export async function deleteService(id: string, actor: Actor) {
  assertServices(actor);
  const row = await db().service.delete({ where: { id } }).catch(() => null);
  if (!row) throw new CatalogError("Service not found.", 404);
  await audit({ actorId: actor.id, action: "service.deleted", entityType: "Service", entityId: id, metadata: { title: row.title } });
}

// ---------------------------------------------------------------------------
// Services for the public pages
// ---------------------------------------------------------------------------

export type ServiceView = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  offerings: string[];
  idealFor: string[];
  notice: string | null;
  category: { slug: string; title: string } | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

function toView(s: PublicService): ServiceView {
  return {
    slug: s.slug,
    title: s.title,
    shortTitle: s.shortTitle || s.title,
    summary: s.summary,
    description: s.description || s.summary,
    offerings: stringList(s.offerings),
    idealFor: stringList(s.idealFor),
    notice: s.notice,
    category: s.category ? { slug: s.category.slug, title: s.category.title } : null,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
  };
}

/** Published services in display order; the starting text if the database can't be reached (e.g. during a build). */
export async function siteServices(): Promise<ServiceView[]> {
  try {
    await db().$queryRaw`SELECT 1`;
  } catch {
    return serviceSeeds.map((s) => ({ ...s, category: null, seoTitle: null, seoDescription: null }));
  }
  return (await publishedServices()).map(toView);
}

export async function siteService(slug: string): Promise<ServiceView | null> {
  return (await siteServices()).find((s) => s.slug === slug) ?? null;
}
