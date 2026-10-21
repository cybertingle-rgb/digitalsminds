import "server-only";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { unreadCount } from "@/modules/notifications/service";

/** Tabs for the student area, with the unread notification count. */
export async function accountNavItems(userId: string, locale: Locale, dict: Dictionary) {
  const unread = await unreadCount(userId);
  return [
    { label: dict.account.navDashboard, href: localizePath("/account", locale), icon: "dashboard" as const },
    { label: dict.account.navCourses, href: localizePath("/account/courses", locale), icon: "courses" as const },
    { label: dict.live.title, href: localizePath("/account/live", locale), icon: "live" as const },
    { label: dict.account.navCertificates, href: localizePath("/account/certificates", locale), icon: "certificates" as const },
    { label: dict.notifications.title, href: localizePath("/account/notifications", locale), icon: "bell" as const, badge: unread ? format(dict.notifications.newCount, { count: String(unread) }) : undefined },
    { label: dict.support.title, href: localizePath("/account/support", locale), icon: "support" as const },
    { label: dict.account.navProfile, href: localizePath("/account/profile", locale), icon: "profile" as const },
  ];
}
