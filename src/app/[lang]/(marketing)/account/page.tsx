import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FormAlert } from "@/components/forms/Field";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { localizePath } from "@/i18n/config";
import { format } from "@/i18n/merge";
import { authPage, noindex } from "@/modules/auth/pages";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: noindex };

export default async function AccountPage({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const t = dict.account;
  const sp = await searchParams;

  return (
    <Section>
      <div className="max-w-2xl space-y-6">
        {sp.verified && <FormAlert tone="success">{dict.auth.verifiedNotice}</FormAlert>}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.title}</p>
          <h1 className="mt-2 text-3xl font-bold text-charcoal-900">{format(t.welcome, { name: user.name })}</h1>
        </div>
        <div className="rounded-2xl border border-line p-6">
          <h2 className="font-semibold text-charcoal-900">{t.profile}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{dict.auth.email}</dt>
              <dd dir="ltr" className="text-start">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">{dict.auth.googleEmail}</dt>
              <dd dir="ltr" className="text-start">{user.googleEmail ?? "-"}</dd>
            </div>
          </dl>
        </div>
        <p className="rounded-2xl bg-sun-50 p-6 text-charcoal-900">{t.coursesSoon}</p>
        <div className="flex flex-wrap gap-3">
          {can(user.role, "admin.access") && <LinkButton href="/admin">{t.adminLink}</LinkButton>}
          <LogoutButton label={dict.auth.logout} redirectTo={localizePath("/", locale)} />
        </div>
      </div>
    </Section>
  );
}
