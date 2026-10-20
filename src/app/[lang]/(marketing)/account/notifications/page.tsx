import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/learning/AccountNav";
import { Section } from "@/components/ui/Section";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { accountNavItems } from "@/modules/learning/account-nav";
import { listNotifications, markAllRead } from "@/modules/notifications/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications", robots: noindex };

export default async function NotificationsPage({ params }: PageProps<"/[lang]/account/notifications">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account/notifications", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const [items, nav] = await Promise.all([listNotifications(user.id), accountNavItems(user.id, locale, dict)]);
  // Opening the page counts as reading them; the list above still highlights what was new.
  await markAllRead(user.id);
  const t = dict.notifications;
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

  return (
    <Section>
      <div className="max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold text-charcoal-900">{t.title}</h1>
        <AccountNav items={nav} label={dict.account.title} />
        {items.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">{t.empty}</p>
        ) : (
          <ul className="glass divide-y divide-charcoal-200/50 rounded-2xl">
            {items.map((n) => (
              <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 p-5 ${n.readAt ? "" : "bg-sun-50"}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal-900" dir="auto">
                    {!n.readAt && <span className="me-2 inline-block h-2 w-2 rounded-full bg-sun-500 align-middle" aria-hidden="true" />}
                    {n.title}
                  </p>
                  {n.body && <p className="mt-1 whitespace-pre-line text-sm text-charcoal-800" dir="auto">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{fmt.format(n.createdAt)}</p>
                </div>
                {n.link && (
                  <Link href={localizePath(n.link, locale)} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4">{t.open}</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
