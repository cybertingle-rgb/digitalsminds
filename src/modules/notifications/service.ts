import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * In-app notifications. Text is stored ready to show (in the recipient's
 * language when the caller has it); `link` is an unlocalized path such as
 * "/learn/course-slug" that the page localizes when rendering.
 */
export async function notify(userIds: string | string[], n: { type: NotificationType; title: string; body?: string | null; link?: string | null }) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += 500) {
      await db().notification.createMany({
        data: ids.slice(i, i + 500).map((userId) => ({
          userId,
          type: n.type,
          title: n.title.slice(0, 200),
          body: n.body?.slice(0, 1000) ?? null,
          link: n.link?.slice(0, 500) ?? null,
        })),
      });
    }
  } catch (err) {
    // Notifications are a convenience; never fail the action that caused them.
    console.warn("[notifications] not created:", err instanceof Error ? err.message : err);
  }
}

export function listNotifications(userId: string, take = 50) {
  return db().notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export function unreadCount(userId: string) {
  return db().notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  await db().notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
