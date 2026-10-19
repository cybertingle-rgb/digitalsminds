import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormAlert } from "@/components/forms/Field";
import { siteConfig } from "@/config/site";
import { localizePath } from "@/i18n/config";
import { isAuthConfigured } from "@/lib/env";
import { noindex, authPage } from "@/modules/auth/pages";
import { getCurrentUser, safeNext } from "@/modules/auth/session";
import { getGoogleStatus } from "@/modules/settings/integrations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in", robots: noindex };

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { locale, dict } = await authPage(params);
  const t = dict.auth;
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, localizePath("/account", locale));

  if (!isAuthConfigured()) {
    return (
      <AuthCard title={t.loginTitle}>
        <FormAlert tone="info">{t.unavailable}</FormAlert>
      </AuthCard>
    );
  }
  if (await getCurrentUser()) redirect(next);
  const google = await getGoogleStatus();

  return (
    <AuthCard
      title={t.loginTitle}
      subtitle={t.loginSubtitle}
      footer={
        <>
          {t.noAccount}{" "}
          <Link href={localizePath("/register", locale)} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">
            {t.registerLink}
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {sp.setup && <FormAlert tone="success">Super Admin account created. Log in with {siteConfig.superAdminEmail}.</FormAlert>}
        {sp.verified && <FormAlert tone="success">{t.verifiedNotice}</FormAlert>}
        {sp.reset && <FormAlert tone="success">{t.resetNotice}</FormAlert>}
        {sp.error && <FormAlert>{t.errors.generic}</FormAlert>}
        <LoginForm
          t={t}
          next={next}
          staffHome="/admin"
          forgotHref={localizePath("/forgot-password", locale)}
          googleEnabled={google.enabled}
          googleErrorUrl={`${localizePath("/login", locale)}?error=google`}
        />
      </div>
    </AuthCard>
  );
}
