import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AccountNav } from "@/components/learning/AccountNav";
import { Section } from "@/components/ui/Section";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { accountNavItems } from "@/modules/learning/account-nav";

/**
 * Student portal shell: sidebar (large screens) or tabs (phones) around every
 * /account page. Signed-out visitors get the page alone, which redirects them
 * to log in with the right return address.
 */
export default async function AccountLayout({ children, params }: LayoutProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  const dict = getDictionary(lang);
  const t = dict.account;
  const nav = await accountNavItems(user.id, lang, dict);
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

  return (
    <Section className="!py-8 sm:!py-12">
      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0">
          <div className="glass-blur rounded-3xl p-3 lg:sticky lg:top-28 lg:p-4">
            <div className="hidden items-center gap-3 px-2 pb-4 pt-1 lg:flex">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-charcoal-900 text-sm font-bold text-sun-400">{initials}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-charcoal-900" dir="auto">{user.name}</span>
                <span className="block text-xs text-muted">{t.portal}</span>
              </span>
            </div>
            <AccountNav items={nav} label={t.title} />
            <div className="mt-4 hidden space-y-2 border-t border-charcoal-200/60 px-1 pt-4 lg:block">
              {can(user.role, "admin.access") && (
                <Link href="/admin" className="block rounded-xl px-2.5 py-2 text-sm font-semibold text-charcoal-800 hover:bg-white/80">{t.adminLink}</Link>
              )}
              <LogoutButton label={dict.auth.logout} redirectTo={localizePath("/", lang)} variant="ghost" />
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Section>
  );
}
