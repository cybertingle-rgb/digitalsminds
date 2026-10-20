import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";

export default async function WebsiteLayout({ children }: LayoutProps<"/[lang]/admin/website">) {
  const user = await requirePagePermission("admin.access", "/admin/website");
  const content = can(user.role, "content.manage");
  if (!content && !can(user.role, "settings.manage")) notFound();
  const tabs = [
    ...(content
      ? [
          { label: "Homepage", href: "/admin/website" },
          { label: "Blog", href: "/admin/website/blog" },
          { label: "FAQs", href: "/admin/website/faqs" },
          { label: "Testimonials", href: "/admin/website/testimonials" },
          { label: "Case studies", href: "/admin/website/case-studies" },
          { label: "Legal pages", href: "/admin/website/legal" },
          { label: "Search & sharing", href: "/admin/website/seo" },
          { label: "Contact & social", href: "/admin/website/contact" },
        ]
      : []),
    ...(can(user.role, "settings.manage") ? [
          { label: "Logo", href: "/admin/website/logo" },
          { label: "Analytics", href: "/admin/website/analytics" },
        ] : []),
  ];
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Website</h1>
        <p className="mt-1 text-muted">Edit the public website. Saved changes appear on the site straight away (at most a minute).</p>
      </div>
      <AdminTabs items={tabs} label="Website sections" />
      {children}
    </div>
  );
}
