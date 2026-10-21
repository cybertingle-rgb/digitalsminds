import "server-only";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { unreadCount } from "@/modules/notifications/service";

/** Tabs for the student portal, with the unread notification count. */
export async function accountNavItems(userId: string, locale: Locale, dict: Dictionary) {
  const unread = await unreadCount(userId);
  const p = dict.portal;
  return [
    { label: dict.account.navDashboard, href: localizePath("/account", locale), icon: "dashboard" as const },
    { label: p.navProgram, href: localizePath("/account/program", locale), icon: "courses" as const },
    { label: p.navSchedule, href: localizePath("/account/schedule", locale), icon: "live" as const },
    { label: p.navOnboarding, href: localizePath("/account/onboarding", locale), icon: "checklist" as const },
    { label: p.navDocuments, href: localizePath("/account/documents", locale), icon: "documents" as const },
    { label: p.navNotices, href: localizePath("/account/notices", locale), icon: "megaphone" as const },
    { label: dict.account.navCertificates, href: localizePath("/account/certificates", locale), icon: "certificates" as const },
    { label: dict.notifications.title, href: localizePath("/account/notifications", locale), icon: "bell" as const, badge: unread ? format(dict.notifications.newCount, { count: String(unread) }) : undefined },
    { label: dict.support.title, href: localizePath("/account/support", locale), icon: "support" as const },
    { label: dict.account.navProfile, href: localizePath("/account/profile", locale), icon: "profile" as const },
  ];
}
