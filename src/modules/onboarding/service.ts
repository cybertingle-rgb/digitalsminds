import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deleteFile, putFile } from "@/lib/storage/local";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { cleanFileName, detectFile } from "@/modules/media/validate";

/**
 * Onboarding checklists and student documents, for all students, one
 * program or one batch. Super Admins and Content Managers manage them.
 */

export class OnboardingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "OnboardingError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

/** "all", "course:<id>" or "batch:<id>". */
export const scopeSchema = z.string().regex(/^(all|course:[\w-]{1,64}|batch:[\w-]{1,64})$/, "Choose who it's for");

async function resolveScope(value: string) {
  if (value === "all") return { courseId: null, batchId: null };
  const [kind, id] = value.split(":") as ["course" | "batch", string];
  if (kind === "course") {
    if (!(await db().course.findUnique({ where: { id }, select: { id: true } }))) throw new OnboardingError("Program not found.", 404);
    return { courseId: id, batchId: null };
  }
  const batch = await db().batch.findUnique({ where: { id }, select: { id: true, courseId: true } });
  if (!batch) throw new OnboardingError("Batch not found.", 404);
  return { courseId: batch.courseId, batchId: id };
}

function assertCanManage(actor: Actor) {
  if (!can(actor.role, "onboarding.manage")) throw new OnboardingError("You don't have permission to manage onboarding.", 403);
}

export function scopeOf(x: { courseId: string | null; batchId: string | null }) {
  return x.batchId ? `batch:${x.batchId}` : x.courseId ? `course:${x.courseId}` : "all";
}

/** Who a checklist item or document can be for. */
export async function scopeOptions() {
  const [programs, batches] = await Promise.all([
    db().course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db().batch.findMany({ where: { status: { notIn: ["CANCELLED", "COMPLETED"] } }, orderBy: { startDate: "desc" }, select: { id: true, name: true, code: true } }),
  ]);
  return [
    { value: "all", label: "All students" },
    ...programs.map((c) => ({ value: `course:${c.id}`, label: `Program: ${c.title}` })),
    ...batches.map((b) => ({ value: `batch:${b.id}`, label: `Batch: ${b.name} (${b.code})` })),
  ];
}

// ---------------------------------------------------------------------------
// Checklist items
// ---------------------------------------------------------------------------

export const itemInput = z.object({
  scope: scopeSchema,
  title: z.string().trim().min(3, "Enter the step").max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  required: z.boolean(),
  studentCompletes: z.boolean(),
  position: z.coerce.number().int().min(0).max(999),
});

export async function createItem(input: z.infer<typeof itemInput>, actor: Actor) {
  assertCanManage(actor);
  const scope = await resolveScope(input.scope);
  const item = await db().onboardingItem.create({
    data: { ...scope, title: input.title, description: input.description, required: input.required, studentCompletes: input.studentCompletes, position: input.position },
  });
  await audit({ actorId: actor.id, action: "onboarding.item_created", entityType: "OnboardingItem", entityId: item.id, metadata: { title: item.title } });
  return item;
}

export async function updateItem(id: string, input: z.infer<typeof itemInput>, actor: Actor) {
  assertCanManage(actor);
  if (!(await db().onboardingItem.findUnique({ where: { id }, select: { id: true } }))) throw new OnboardingError("Step not found.", 404);
  const scope = await resolveScope(input.scope);
  await db().onboardingItem.update({
    where: { id },
    data: { ...scope, title: input.title, description: input.description, required: input.required, studentCompletes: input.studentCompletes, position: input.position },
  });
  await audit({ actorId: actor.id, action: "onboarding.item_updated", entityType: "OnboardingItem", entityId: id, metadata: { title: input.title } });
}

/** Archived steps disappear from checklists; students' ticks are kept for the record. */
export async function archiveItem(id: string, actor: Actor) {
  assertCanManage(actor);
  const item = await db().onboardingItem.update({ where: { id }, data: { archivedAt: new Date() } }).catch(() => null);
  if (!item) throw new OnboardingError("Step not found.", 404);
  await audit({ actorId: actor.id, action: "onboarding.item_archived", entityType: "OnboardingItem", entityId: id, metadata: { title: item.title } });
}

export function listItems() {
  return db().onboardingItem.findMany({
    where: { archivedAt: null },
    orderBy: [{ batchId: "asc" }, { courseId: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    include: { course: { select: { title: true } }, batch: { select: { name: true, code: true } }, _count: { select: { progress: true } } },
  });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const documentInput = z.object({
  scope: scopeSchema,
  title: z.string().trim().min(3, "Enter a title").max(200),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
});

/** Stores a document privately (PDF, Word, Excel, PowerPoint or an image; checked by content). */
export async function uploadDocument(input: z.infer<typeof documentInput>, file: { data: Buffer; name: string }, actor: Actor) {
  assertCanManage(actor);
  if (file.data.length > DOCUMENT_MAX_BYTES) throw new OnboardingError("The file is too large (25 MB at most).", 413);
  const detected = detectFile(file.data, file.name);
  if (!detected) throw new OnboardingError("Upload a PDF, Word, Excel or PowerPoint file, or a JPG/PNG/WebP image.", 422);
  const scope = await resolveScope(input.scope);
  const now = new Date();
  const key = `documents/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${detected.ext}`;
  await putFile(key, file.data);
  try {
    const doc = await db().studentDocument.create({
      data: { ...scope, title: input.title, description: input.description, storageKey: key, fileName: cleanFileName(file.name), mimeType: detected.mime, sizeBytes: file.data.length, uploadedById: actor.id },
    });
    await audit({ actorId: actor.id, action: "document.uploaded", entityType: "StudentDocument", entityId: doc.id, metadata: { title: doc.title } });
    return doc;
  } catch (e) {
    await deleteFile(key).catch(() => {});
    throw e;
  }
}

export async function setDocumentPublished(id: string, published: boolean, actor: Actor) {
  assertCanManage(actor);
  const doc = await db().studentDocument.update({ where: { id }, data: { published } }).catch(() => null);
  if (!doc) throw new OnboardingError("Document not found.", 404);
  await audit({ actorId: actor.id, action: published ? "document.published" : "document.hidden", entityType: "StudentDocument", entityId: id, metadata: { title: doc.title } });
}

export async function deleteDocument(id: string, actor: Actor) {
  assertCanManage(actor);
  const doc = await db().studentDocument.findUnique({ where: { id } });
  if (!doc) throw new OnboardingError("Document not found.", 404);
  await db().studentDocument.delete({ where: { id } });
  await deleteFile(doc.storageKey).catch(() => {});
  await audit({ actorId: actor.id, action: "document.deleted", entityType: "StudentDocument", entityId: id, metadata: { title: doc.title } });
}

export function listDocuments(where: Prisma.StudentDocumentWhereInput = {}) {
  return db().studentDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true } }, batch: { select: { name: true, code: true } }, uploadedBy: { select: { name: true } } },
  });
}
