import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Append an entry to the audit log. Never pass passwords, tokens or secrets in `metadata`. */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  await db().auditLog.create({ data: { ...entry, entityId: entry.entityId ?? null, ipAddress: entry.ipAddress ?? null } });
}
