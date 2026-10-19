import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { isSetupComplete, setupCodeConfigured } from "@/modules/auth/setup";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } };

/** One-time owner setup. Disappears (404) once a Super Admin exists. */
export default async function SetupPage({ params }: PageProps<"/[lang]/setup">) {
  if ((await params).lang !== "en") redirect("/setup");
  if (await isSetupComplete()) notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-alt px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line border-t-4 border-t-sun-400 bg-white p-6 shadow-sm sm:p-8">
        <Image src={siteConfig.logo.light.src} alt="Digitals Minds" width={siteConfig.logo.light.width} height={siteConfig.logo.light.height} className="h-14 w-auto" priority />
        <h1 className="mt-6 text-2xl font-bold text-charcoal-900">Create the Super Admin account</h1>
        <p className="mt-2 text-sm text-muted">
          This page works once. After the account is created it disappears. You can then set up email and Google sign-in from the admin panel.
        </p>
        <div className="mt-6">
          {setupCodeConfigured() ? (
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
