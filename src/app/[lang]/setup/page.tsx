import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { brand, siteConfig } from "@/config/site";
import { getLogos } from "@/modules/content/settings";
import { isAuthConfigured } from "@/lib/env";
import { isSetupComplete, setupCodeConfigured } from "@/modules/auth/setup";
import { OwnerResetForm } from "./OwnerResetForm";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } };

/**
 * One-time owner setup. Once a Super Admin exists the page is hidden (404), unless
 * ADMIN_SETUP_CODE is set again: then it offers owner password recovery instead.
 */
export default async function SetupPage({ params }: PageProps<"/[lang]/setup">) {
  const logo = (await getLogos()).light;
  if ((await params).lang !== "en") redirect("/setup");
  if (await isSetupComplete()) {
    if (!isAuthConfigured() || !setupCodeConfigured()) notFound();
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-md glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6 sm:p-8">
          <Image src={logo.src} alt={brand.name} width={logo.width} height={logo.height} className="h-9 w-auto" priority />
          <h1 className="mt-6 text-2xl font-bold text-charcoal-900">Reset the owner password</h1>
          <p className="mt-2 text-sm text-muted">
            For when you can&apos;t receive the reset email. Only the owner&apos;s password changes; all accounts and data stay as they are. Remove
            ADMIN_SETUP_CODE in Hostinger afterwards.
          </p>
          <div className="mt-6">
            <OwnerResetForm email={siteConfig.superAdminEmail} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6 sm:p-8">
        <Image src={logo.src} alt={brand.name} width={logo.width} height={logo.height} className="h-9 w-auto" priority />
        <h1 className="mt-6 text-2xl font-bold text-charcoal-900">Create the Super Admin account</h1>
        <p className="mt-2 text-sm text-muted">
          This page works once. After the account is created it disappears. You can then set up email and Google sign-in from the admin panel.
        </p>
        <div className="mt-6">
          {!isAuthConfigured() ? (
            <p role="alert" className="rounded-lg bg-sun-50 p-4 text-sm text-charcoal-900">
              Accounts are not configured yet. In Hostinger → Environment variables add <strong>BETTER_AUTH_SECRET</strong> (at least 32 random
              characters from a password generator, keep it forever) and <strong>ADMIN_SETUP_CODE</strong>, redeploy, then reload this page.
            </p>
          ) : setupCodeConfigured() ? (
            <SetupForm email={siteConfig.superAdminEmail} />
          ) : (
            <p role="alert" className="rounded-lg bg-sun-50 p-4 text-sm text-charcoal-900">
              Setup is disabled. Add an <strong>ADMIN_SETUP_CODE</strong> environment variable (at least 16 random characters) in Hostinger, redeploy, then reload this page.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
