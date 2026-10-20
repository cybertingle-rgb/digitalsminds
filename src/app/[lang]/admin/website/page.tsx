import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { requirePagePermission } from "@/modules/auth/session";
import { getHomeContent, homeInput } from "@/modules/content/settings";
import { HomeForm } from "./WebsiteForms";

export const metadata: Metadata = { title: "Website" };

export default async function WebsiteHomePage() {
  await requirePagePermission("content.manage", "/admin/website");
  const dict = getDictionary("en");
  const value = (await getHomeContent()) ?? homeInput.parse({});
  return (
    <HomeForm
      value={value}
      defaults={{ heroTitle: dict.brand.positioning, heroText: dict.home.heroText, whyTitle: dict.home.whyTitle, why: dict.home.why, ctaTitle: dict.cta.title, ctaText: dict.cta.text }}
    />
  );
}
