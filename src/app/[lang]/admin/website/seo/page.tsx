import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { requirePagePermission } from "@/modules/auth/session";
import { getSeoSetting, publicImages, seoPageLabels, seoPages } from "@/modules/content/settings";
import { SeoForm } from "../WebsiteForms";

export const metadata: Metadata = { title: "Search & sharing" };

export default async function SeoSettingsPage() {
  await requirePagePermission("content.manage", "/admin/website/seo");
  const d = getDictionary("en");
  const [seo, images] = await Promise.all([getSeoSetting(), publicImages()]);
  const defaults: Record<(typeof seoPages)[number], [string, string]> = {
    home: [d.meta.siteTitle, d.meta.description],
    about: [d.nav.about, d.about.metaDescription],
    services: [d.nav.services, d.servicesPage.metaDescription],
    courses: [d.courses.title, d.courses.description],
    caseStudies: [d.caseStudies.title, d.caseStudies.description],
    blog: [d.nav.blog, d.blog.metaDescription],
    contact: [d.nav.contact, d.contact.metaDescription],
  };
  return (
    <SeoForm
      images={images}
      pages={seoPages.map((p) => ({ key: p, label: seoPageLabels[p], ...seo[p], defaultTitle: defaults[p][0], defaultDescription: defaults[p][1] }))}
    />
  );
}
