import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deleteFile, putFile } from "@/lib/storage/local";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { processImage } from "./images";
import { getStorageStatus } from "./storage-check";
import { cleanFileName, detectFile, LIMITS, slugForKey } from "./validate";

export class MediaError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "MediaError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
export type Visibility = "PUBLIC" | "PRIVATE";

export function canUseMediaLibrary(user: Actor) {
  return can(user.role, "media.manage.all") || can(user.role, "media.manage.own");
}

/** Instructors only see and change their own uploads. */
export function mediaScope(user: Actor): Prisma.MediaAssetWhereInput {
  return can(user.role, "media.manage.all") ? {} : { uploadedById: user.id };
}

async function findManageable(id: string, user: Actor) {
  const asset = await db().mediaAsset.findFirst({ where: { id, ...mediaScope(user) } });
  if (!asset) throw new MediaError("File not found.", 404);
  return asset;
}

/** Public files are served at /media/<rest of key>; private ones through an access-checked route. */
export function mediaUrl(asset: { id: string; storageKey: string; visibility: string }) {
  return asset.visibility === "PUBLIC" ? `/media/${asset.storageKey.replace(/^public\//, "")}` : `/api/files/${asset.id}`;
}

async function prepare(data: Buffer, originalName: string) {
  const detected = detectFile(data, originalName);
  if (!detected) {
    throw new MediaError("This file type isn't allowed. Upload JPG, PNG or WebP images, or PDF, Word, Excel or PowerPoint documents.", 415);
  }
  if (data.length > LIMITS[detected.kind]) {
    throw new MediaError(detected.kind === "image" ? "Images can be at most 8 MB." : "Documents can be at most 25 MB.", 413);
  }
  if (detected.kind === "image") {
    try {
      const img = await processImage(data, detected.mime);
      return { detected, data: img.data, width: img.width, height: img.height };
    } catch {
      throw new MediaError("This image appears to be damaged and couldn't be processed.", 415);
    }
  }
  return { detected, data, width: null, height: null };
}

function newKey(visibility: Visibility, name: string, ext: string) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const folder = visibility === "PUBLIC" ? "public" : "private";
  return `${folder}/${now.getUTCFullYear()}/${month}/${randomUUID().slice(0, 12)}-${slugForKey(name)}.${ext}`;
}

async function requireStorage() {
  const status = await getStorageStatus();
  if (!status.uploadsEnabled) {
    throw new MediaError("Uploads are switched off until file storage is confirmed in Admin → Integrations → File storage.", 503);
  }
}

export async function uploadAsset(
  input: { data: Buffer; originalName: string; visibility: Visibility; altText?: string | null; altTextUr?: string | null },
  user: Actor,
) {
  if (!canUseMediaLibrary(user)) throw new MediaError("You don't have permission to upload files.", 403);
  await requireStorage();
  const name = cleanFileName(input.originalName);
  const file = await prepare(input.data, name);
  const storageKey = newKey(input.visibility, name, file.detected.ext);
  await putFile(storageKey, file.data);
  try {
    const asset = await db().mediaAsset.create({
      data: {
        storageKey,
        originalName: name,
        mimeType: file.detected.mime,
        sizeBytes: file.data.length,
        width: file.width,
        height: file.height,
        checksum: createHash("sha256").update(file.data).digest("hex"),
        altText: input.altText?.trim().slice(0, 255) || null,
        altTextUr: input.altTextUr?.trim().slice(0, 255) || null,
        visibility: input.visibility,
        uploadedById: user.id,
      },
    });
    await audit({ actorId: user.id, action: "media.upload", entityType: "MediaAsset", entityId: asset.id, metadata: { name, visibility: input.visibility, bytes: file.data.length } });
    return asset;
  } catch (e) {
    await deleteFile(storageKey); // don't leave an orphaned file behind
    throw e;
  }
}

/** Swaps the file behind an asset; links and course references keep working. */
export async function replaceAsset(id: string, input: { data: Buffer; originalName: string }, user: Actor) {
  const asset = await findManageable(id, user);
  await requireStorage();
  const name = cleanFileName(input.originalName);
  const file = await prepare(input.data, name);
  const wasImage = asset.mimeType.startsWith("image/");
  if (wasImage !== (file.detected.kind === "image")) {
    throw new MediaError(wasImage ? "Replace an image with another image." : "Replace a document with another document.");
  }
  const storageKey = newKey(asset.visibility, name, file.detected.ext);
  await putFile(storageKey, file.data);
  const updated = await db().mediaAsset.update({
    where: { id },
    data: {
      storageKey,
      originalName: name,
      mimeType: file.detected.mime,
      sizeBytes: file.data.length,
      width: file.width,
      height: file.height,
      checksum: createHash("sha256").update(file.data).digest("hex"),
    },
  });
  await deleteFile(asset.storageKey);
  await audit({ actorId: user.id, action: "media.replace", entityType: "MediaAsset", entityId: id, metadata: { name } });
  return updated;
}

/** Where a file is used; a file that is used anywhere can't be deleted. */
export async function mediaUsage(id: string): Promise<string[]> {
  const a = await db().mediaAsset.findUnique({
    where: { id },
    select: {
      courseThumbnails: { select: { title: true } },
      courseResources: { select: { title: true, course: { select: { title: true } } } },
      postCovers: { select: { title: true } },
      testimonialPhotos: { select: { name: true } },
      caseStudyCovers: { select: { title: true } },
    },
  });
  if (!a) return [];
  return [
    ...a.courseThumbnails.map((c) => `Thumbnail of course “${c.title}”`),
    ...a.courseResources.map((r) => `Resource “${r.title}” in course “${r.course.title}”`),
    ...a.postCovers.map((p) => `Cover of blog post “${p.title}”`),
    ...a.testimonialPhotos.map((t) => `Photo for testimonial by ${t.name}`),
    ...a.caseStudyCovers.map((c) => `Cover of case study “${c.title}”`),
  ];
}

export async function deleteAsset(id: string, user: Actor) {
  const asset = await findManageable(id, user);
  const usage = await mediaUsage(id);
  if (usage.length > 0) throw new MediaError(`This file is still in use: ${usage.join("; ")}. Remove it there first.`, 409);
  await db().mediaAsset.delete({ where: { id } });
  await deleteFile(asset.storageKey);
  await audit({ actorId: user.id, action: "media.delete", entityType: "MediaAsset", entityId: id, metadata: { name: asset.originalName } });
}

export async function updateAltText(id: string, altText: string, altTextUr: string, user: Actor) {
  await findManageable(id, user);
  await db().mediaAsset.update({
    where: { id },
    data: { altText: altText.trim().slice(0, 255) || null, altTextUr: altTextUr.trim().slice(0, 255) || null },
  });
}

export async function listAssets(user: Actor, opts: { q?: string; type?: "image" | "document"; page: number; pageSize: number }) {
  const where: Prisma.MediaAssetWhereInput = {
    ...mediaScope(user),
    ...(opts.q ? { OR: [{ originalName: { contains: opts.q } }, { altText: { contains: opts.q } }] } : {}),
    ...(opts.type === "image" ? { mimeType: { startsWith: "image/" } } : opts.type === "document" ? { NOT: { mimeType: { startsWith: "image/" } } } : {}),
  };
  const [items, total] = await Promise.all([
    db().mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { uploadedBy: { select: { name: true } } },
    }),
    db().mediaAsset.count({ where }),
  ]);
  return { items, total };
}
