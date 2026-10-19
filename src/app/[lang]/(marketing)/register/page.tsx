import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { FormAlert } from "@/components/forms/Field";
import { localizePath } from "@/i18n/config";
import { isAuthConfigured } from "@/lib/env";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { getGoogleStatus } from "@/modules/settings/integrations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account", robots: noindex };

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { locale, dict } = await authPage(params);
  const t = dict.auth;
  const account = localizePath("/account", locale);
  if (!isAuthConfigured()) {
    return (
      <AuthCard title={t.registerTitle}>
        <FormAlert tone="info">{t.unavailable}</FormAlert>
      </AuthCard>
    );
  }
  if (await getCurrentUser()) redirect(account);
  const google = await getGoogleStatus();

  return (
    <AuthCard
      title={t.registerTitle}
      subtitle={t.registerSubtitle}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href={localizePath("/login", locale)} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">
            {t.loginLink}
          </Link>
        </>
      }
    >
      <RegisterForm
        t={t}
        locale={locale}
        verifiedCallback={`${account}?verified=1`}
        googleEnabled={google.enabled}
        googleCallback={account}
        googleErrorUrl={`${localizePath("/register", locale)}?error=google`}
      />
    </AuthCard>
  );
}
