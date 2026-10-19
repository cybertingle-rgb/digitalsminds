import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { requirePagePermission } from "@/modules/auth/session";
import { getGoogleStatus, getSmtpStatus, markGoogleVerified } from "@/modules/settings/integrations";
import { getStorageStatus } from "@/modules/media/storage-check";
import { EmailCard } from "./EmailCard";
import { StorageCard } from "./StorageCard";
import { GoogleCard } from "./GoogleCard";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({ searchParams }: PageProps<"/[lang]/admin/integrations">) {
  const user = await requirePagePermission("integrations.manage", "/admin/integrations");
  const sp = await searchParams;
  let google = await getGoogleStatus();
  let flash: "linked" | "error" | "unverified" | null = sp.google === "error" ? "error" : null;

  // Returning from "Connect & test": confirm Google really linked an account for this admin.
  if (sp.google === "linked" && google.configured) {
    const linked = await db().account.findFirst({
      where: { userId: user.id, providerId: "google", updatedAt: { gte: new Date(google.updatedAt ?? 0) } },
      select: { id: true },
    });
    if (linked && !google.verifiedAt) {
      await markGoogleVerified(user.id);
      await audit({ actorId: user.id, action: "integration.google.verified", entityType: "Integration", entityId: "google" });
      google = await getGoogleStatus();
    }
    flash = linked ? "linked" : "unverified";
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Integrations</h1>
        <p className="mt-1 text-muted">Connect the services the website uses. Passwords and secrets are stored encrypted and never shown again.</p>
      </div>
      <EmailCard status={await getSmtpStatus()} adminEmail={user.email} />
      <GoogleCard status={google} origin={siteConfig.url} redirectUri={`${siteConfig.url}/api/auth/callback/google`} flash={flash} />
      <StorageCard status={await getStorageStatus()} />
    </div>
  );
}
