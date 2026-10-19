import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { FormAlert } from "@/components/forms/Field";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password", robots: noindex };

export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[lang]/reset-password">) {
  const { locale, dict } = await authPage(params);
  const t = dict.auth;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;

  return (
    <AuthCard title={t.resetTitle}>
      {token && !sp.error ? (
        <ResetPasswordForm t={t} token={token} loginHref={localizePath("/login", locale)} />
      ) : (
        <div className="space-y-4">
          <FormAlert>{t.resetInvalid}</FormAlert>
          <Link href={localizePath("/forgot-password", locale)} className="text-sm font-semibold underline-offset-4 hover:underline">
            {t.forgotButton}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
