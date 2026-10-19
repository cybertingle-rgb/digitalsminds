import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { siteConfig } from "@/config/site";
import { can, roleLabels } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Digitals Minds" },
  robots: { index: false, follow: false },
};

/** Admin portal (English only). Every page below re-checks its own permission too. */
export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  if ((await params).lang !== "en") redirect("/admin");
  const user = await requirePagePermission("admin.access", "/admin");

  const nav = [
    { label: "Overview", href: "/admin" },
    ...(can(user.role, "inquiries.manage") ? [{ label: "Inquiries", href: "/admin/inquiries" }] : []),
    ...(can(user.role, "media.manage.all") || can(user.role, "media.manage.own") ? [{ label: "Media", href: "/admin/media" }] : []),
    ...(can(user.role, "staff.manage") ? [{ label: "Team", href: "/admin/team" }] : []),
    ...(can(user.role, "integrations.manage") ? [{ label: "Integrations", href: "/admin/integrations" }] : []),
    ...(can(user.role, "audit.view") ? [{ label: "Activity", href: "/admin/activity" }] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="bg-charcoal-900 text-white md:w-64 md:shrink-0">
        <div className="md:sticky md:top-0">
          <div className="flex items-center justify-between gap-4 p-4 md:block md:p-6">
            <Link href="/admin" aria-label="Admin home">
              <Image src={siteConfig.logo.dark.src} alt="Digitals Minds" width={siteConfig.logo.dark.width} height={siteConfig.logo.dark.height} className="h-12 w-auto" />
            </Link>
            <p className="text-xs font-semibold uppercase tracking-wider text-sun-400 md:mt-3">Admin</p>
          </div>
          <nav aria-label="Admin" className="px-4 pb-4">
            <AdminNav items={nav} />
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-surface-alt">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-8">
          <p className="text-sm text-muted">
            <span className="font-semibold text-charcoal-900">{user.name}</span> · {roleLabels[user.role]}
          </p>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-charcoal-900">
              View site
            </Link>
            <LogoutButton label="Log out" redirectTo="/login" variant="ghost" />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
