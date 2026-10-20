import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { requirePagePermission } from "@/modules/auth/session";
import { getLogoSetting, publicImages } from "@/modules/content/settings";
import { LogoForm } from "../WebsiteForms";

export const metadata: Metadata = { title: "Logo" };

export default async function LogoSettingsPage() {
  await requirePagePermission("settings.manage", "/admin/website/logo");
  const [logo, images] = await Promise.all([getLogoSetting(), publicImages()]);
  return (
    <LogoForm
      value={{ lightId: logo.lightId ?? "", darkId: logo.darkId ?? "" }}
      images={images}
      official={{ light: siteConfig.logo.light.src, dark: siteConfig.logo.dark.src }}
    />
  );
}
