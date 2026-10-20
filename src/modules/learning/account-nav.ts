import "server-only";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { unreadCount } from "@/modules/notifications/service";

/** Tabs for the student area, with the unread notification count. */
export async function accountNavItems(userId: string, locale: Locale, dict: Dictionary) {
  const unread = await unreadCount(userId);
  return [
    { label: dict.nav.myLearning, href: localizePath("/account", locale) },
    { label: dict.notifications.title, href: localizePath("/account/notifications", locale), badge: unread ? format(dict.notifications.newCount, { count: String(unread) }) : undefined },
    { label: dict.support.title, href: localizePath("/account/support", locale) },
  ];
}
