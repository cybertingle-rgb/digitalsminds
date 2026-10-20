import type { Metadata } from "next";
import { requirePagePermission } from "@/modules/auth/session";
import { getAnalyticsSetting } from "@/modules/content/settings";
import { AnalyticsForm } from "../WebsiteForms";

export const metadata: Metadata = { title: "Analytics & Search Console" };

export default async function AnalyticsSettingsPage() {
  await requirePagePermission("settings.manage", "/admin/website/analytics");
  const a = await getAnalyticsSetting();
  return <AnalyticsForm value={{ gaId: a.gaId ?? "", googleVerification: a.googleVerification ?? "" }} />;
}
