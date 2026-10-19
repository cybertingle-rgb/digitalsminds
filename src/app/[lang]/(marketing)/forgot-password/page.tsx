import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";

export const metadata: Metadata = { title: "Reset password", robots: noindex };

export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/forgot-password">) {
  const { locale, dict } = await authPage(params);
  return (
    <AuthCard title={dict.auth.forgotTitle} subtitle={dict.auth.forgotText}>
      <ForgotPasswordForm t={dict.auth} resetPath={localizePath("/reset-password", locale)} />
    </AuthCard>
  );
}
