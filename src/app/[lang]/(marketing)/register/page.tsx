import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LinkButton } from "@/components/ui/Button";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";

export const metadata: Metadata = { title: "Student accounts", robots: noindex };

/** Self sign-up is closed: student accounts are created after a verified enrollment payment. */
export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { locale, dict } = await authPage(params);
  const t = dict.auth;
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
      <div className="space-y-5">
        <p className="text-charcoal-800">{t.signupClosedText}</p>
        <LinkButton href={localizePath("/courses", locale)} className="w-full">{t.seePrograms}</LinkButton>
      </div>
    </AuthCard>
  );
}
