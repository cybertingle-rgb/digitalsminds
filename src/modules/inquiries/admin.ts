import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { pkDayStart, pkTodayRange } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { inquiryStatuses, type InquiryStatus } from "./labels";
import { INQUIRY_SERVICE_OPTIONS } from "./schema";

export class InquiryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InquiryError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

const OPEN: InquiryStatus[] = ["NEW", "CONTACTED", "QUALIFIED"];

export const filtersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(inquiryStatuses as [InquiryStatus, ...InquiryStatus[]]).optional().catch(undefined),
  service: z.enum(INQUIRY_SERVICE_OPTIONS).optional().catch(undefined),
  assignee: z.string().max(64).optional().catch(undefined), // "me" | "none" | userId
  followUp: z.enum(["overdue", "today", "upcoming"]).optional().catch(undefined),
});
export type InquiryFilters = z.infer<typeof filtersSchema>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): InquiryFilters {
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  return filtersSchema.parse({ q: one(sp.q), status: one(sp.status), service: one(sp.service), assignee: one(sp.assignee), followUp: one(sp.followUp) });
}

export function buildWhere(f: InquiryFilters, actor: Actor, now = new Date()): Prisma.InquiryWhereInput {
  const { start, end } = pkTodayRange(now);
  const and: Prisma.InquiryWhereInput[] = [];
  if (f.q) and.push({ OR: [{ name: { contains: f.q } }, { email: { contains: f.q } }, { company: { contains: f.q } }, { message: { contains: f.q } }] });
  // Spam is hidden unless asked for.
  and.push(f.status ? { status: f.status } : { status: { not: "SPAM" } });
  if (f.service) and.push({ service: f.service });
  if (f.assignee === "me") and.push({ assignedToId: actor.id });
  else if (f.assignee === "none") and.push({ assignedToId: null });
  else if (f.assignee) and.push({ assignedToId: f.assignee });
  if (f.followUp) {
    and.push({ status: { in: OPEN } });
    if (f.followUp === "overdue") and.push({ followUpAt: { lt: start } });
    if (f.followUp === "today") and.push({ followUpAt: { gte: start, lt: end } });
    if (f.followUp === "upcoming") and.push({ followUpAt: { gte: end } });
  }
  return { AND: and };
}

export async function listInquiries(f: InquiryFilters, actor: Actor, page: number, pageSize: number) {
  const where = buildWhere(f, actor);
  const [items, total] = await Promise.all([
    db().inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { assignedTo: { select: { name: true } }, _count: { select: { notes: true } } },
    }),
    db().inquiry.count({ where }),
  ]);
  return { items, total };
}

export async function getInquiry(id: string) {
  return db().inquiry.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
}

/** Staff who can be assigned leads: active Super Admins and Content Managers. */
export async function assignableStaff() {
  return db().user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "CONTENT_MANAGER"] }, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export const updateInput = z.object({
  status: z.enum(inquiryStatuses as [InquiryStatus, ...InquiryStatus[]]),
  assignedToId: z.string().max(64).nullable(),
  /** "YYYY-MM-DD" (Pakistan day) or null. */
  followUpDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function updateInquiry(id: string, input: z.infer<typeof updateInput>, actor: Actor) {
  const current = await db().inquiry.findUnique({ where: { id } });
  if (!current) throw new InquiryError("This inquiry no longer exists.");
  if (input.assignedToId) {
    const staff = await db().user.findUnique({ where: { id: input.assignedToId }, select: { role: true, status: true } });
    if (!staff || staff.status !== "ACTIVE" || !can(staff.role, "inquiries.manage")) throw new InquiryError("Leads can only be assigned to active staff who manage inquiries.");
  }
  const followUpAt = input.followUpDay ? pkDayStart(input.followUpDay) : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new InquiryError("Invalid follow-up date.");

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (current.status !== input.status) changes.status = { from: current.status, to: input.status };
  if (current.assignedToId !== input.assignedToId) changes.assignedTo = { from: current.assignedToId, to: input.assignedToId };
  if ((current.followUpAt?.getTime() ?? null) !== (followUpAt?.getTime() ?? null)) changes.followUp = { from: current.followUpAt?.toISOString() ?? null, to: input.followUpDay };
  if (Object.keys(changes).length === 0) return;

  await db().inquiry.update({ where: { id }, data: { status: input.status, assignedToId: input.assignedToId, followUpAt } });
  await audit({ actorId: actor.id, action: "inquiry.updated", entityType: "Inquiry", entityId: id, metadata: changes as Prisma.InputJsonValue });
}

export async function addNote(id: string, body: string, actor: Actor) {
  const text = body.trim();
  if (text.length < 1 || text.length > 5000) throw new InquiryError("Notes must be between 1 and 5000 characters.");
  if (!(await db().inquiry.findUnique({ where: { id }, select: { id: true } }))) throw new InquiryError("This inquiry no longer exists.");
  await db().inquiryNote.create({ data: { inquiryId: id, authorId: actor.id, body: text } });
  await audit({ actorId: actor.id, action: "inquiry.note_added", entityType: "Inquiry", entityId: id });
}

export async function deleteInquiry(id: string, actor: Actor) {
  const current = await db().inquiry.findUnique({ where: { id }, select: { email: true } });
  if (!current) throw new InquiryError("This inquiry no longer exists.");
  await db().inquiry.delete({ where: { id } });
  // Keep a record that it existed, without the personal data.
  await audit({ actorId: actor.id, action: "inquiry.deleted", entityType: "Inquiry", entityId: id });
}

export async function inquiriesForExport(f: InquiryFilters, actor: Actor) {
  return db().inquiry.findMany({
    where: buildWhere(f, actor),
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: { assignedTo: { select: { name: true } } },
  });
}
