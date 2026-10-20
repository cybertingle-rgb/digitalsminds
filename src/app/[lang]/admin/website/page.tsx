import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { requirePagePermission } from "@/modules/auth/session";
import { featuredInput, getFeaturedSetting, getHomeContent, homeInput, publicImages } from "@/modules/content/settings";
import { FeaturedForm, HomeForm } from "./WebsiteForms";

export const metadata: Metadata = { title: "Website" };

export default async function WebsiteHomePage() {
  await requirePagePermission("content.manage", "/admin/website");
  const dict = getDictionary("en");
  const [home, featured, images] = await Promise.all([getHomeContent(), getFeaturedSetting(), publicImages()]);
  const value = home ?? homeInput.parse({});
  const f = featured ?? featuredInput.parse({ enabled: true });
  const fd = dict.featured;
  return (
    <div className="space-y-8">
      <FeaturedForm value={f} images={images} defaults={{ eyebrow: fd.eyebrow, title: fd.title, text: fd.text, price: fd.price, button: fd.button, disclaimer: fd.disclaimer }} />
      <HomeForm
        value={value}
        defaults={{ heroTitle: dict.brand.positioning, heroText: dict.home.heroText, whyTitle: dict.home.whyTitle, why: dict.home.why, ctaTitle: dict.cta.title, ctaText: dict.cta.text }}
      />
    </div>
  );
}
