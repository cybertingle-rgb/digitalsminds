import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/learning/ProfileForm";
import { localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { profileOf } from "@/modules/learning/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile", robots: noindex };

export default async function ProfilePage({ params }: PageProps<"/[lang]/account/profile">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/profile", locale))}`);
  const t = dict.account;
  const profile = await profileOf(user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-charcoal-900">{t.navProfile}</h1>
        <p className="mt-1 text-muted">{t.profileIntro}</p>
      </div>
      <section aria-labelledby="account-email" className="glass rounded-2xl p-6">
        <h2 id="account-email" className="text-sm font-semibold text-muted">{t.signedInWith}</h2>
        <p className="mt-1 font-semibold text-charcoal-900" dir="ltr">{user.email}</p>
        <p className="mt-3 text-sm">
          <Link href={localizePath("/forgot-password", locale)} className="font-semibold text-charcoal-900 underline underline-offset-4">{dict.auth.forgotPassword}</Link>
        </p>
      </section>
      <section aria-labelledby="edit-profile" className="glass rounded-2xl p-6">
        <h2 id="edit-profile" className="mb-4 text-lg font-bold text-charcoal-900">{t.editProfile}</h2>
        <ProfileForm
          lang={locale}
          profile={{
            name: profile?.name ?? user.name,
            googleEmail: profile?.googleEmail ?? user.email,
            phone: profile?.phone ?? "",
            city: profile?.city ?? "",
            preferredLocale: profile?.preferredLocale ?? "en",
          }}
          labels={{
            name: dict.auth.name,
            googleEmail: dict.auth.googleEmail,
            googleHint: dict.courses.requestGoogleHint,
            phone: dict.auth.phone,
            city: dict.auth.city,
            language: t.preferredLanguage,
            save: t.saveProfile,
          }}
        />
      </section>
      <p className="text-sm text-muted">
        {t.deleteNote}{" "}
        <Link href={localizePath("/privacy", locale)} className="underline underline-offset-4">{dict.legal.privacy}</Link>
      </p>
    </div>
  );
}
