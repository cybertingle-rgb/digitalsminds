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
    ...(can(user.role, "courses.manage.all") || can(user.role, "courses.manage.own") ? [{ label: "Courses", href: "/admin/courses" }] : []),
    ...(can(user.role, "enrollments.decide") ? [{ label: "Enrollments", href: "/admin/enrollments" }] : []),
    ...(can(user.role, "announcements.site") || can(user.role, "courses.manage.all") || can(user.role, "courses.manage.own") ? [{ label: "Announcements", href: "/admin/announcements" }] : []),
    ...(can(user.role, "students.view") ? [{ label: "Students", href: "/admin/students" }] : []),
    ...(can(user.role, "inquiries.manage") ? [{ label: "Inquiries", href: "/admin/inquiries" }] : []),
    ...(can(user.role, "media.manage.all") || can(user.role, "media.manage.own") ? [{ label: "Media", href: "/admin/media" }] : []),
    ...(can(user.role, "content.manage") ? [{ label: "Website", href: "/admin/website" }] : []),
    ...(can(user.role, "staff.manage") ? [{ label: "Team", href: "/admin/team" }] : []),
    ...(can(user.role, "integrations.manage") ? [{ label: "Integrations", href: "/admin/integrations" }] : []),
    ...(can(user.role, "audit.view") ? [{ label: "Activity", href: "/admin/activity" }] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-3 md:flex-row md:gap-4">
      {/* Floating glass sidebar (a top bar with a scrolling menu on phones). */}
      <aside className="md:w-60 md:shrink-0">
        <div className="glass-blur rounded-3xl md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-1.5rem)] md:flex-col md:overflow-y-auto">
          <div className="flex items-center justify-between gap-4 p-4 md:block md:p-5">
            <Link href="/admin" aria-label="Admin home">
              <Image src={siteConfig.logo.light.src} alt="Digitals Minds" width={siteConfig.logo.light.width} height={siteConfig.logo.light.height} className="h-11 w-auto" />
            </Link>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-charcoal-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-sun-400 md:mt-3">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sun-400" />
              Admin
            </p>
          </div>
          <nav aria-label="Admin" className="px-3 pb-3 md:pb-5">
            <AdminNav items={nav} />
          </nav>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
        <header className="glass-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5 sm:px-6 md:sticky md:top-3 md:z-30">
          <p className="text-sm text-muted">
            <span className="font-semibold text-charcoal-900">{user.name}</span> · {roleLabels[user.role]}
          </p>
          <div className="flex items-center gap-1">
            <Link href="/" className="rounded-xl px-3 py-2 text-sm text-charcoal-700 hover:bg-white/70 hover:text-charcoal-900">
              View site
            </Link>
            <LogoutButton label="Log out" redirectTo="/login" variant="ghost" />
          </div>
        </header>
        <main id="main" className="flex-1 px-1 py-4 sm:px-3 md:px-4">
          {children}
        </main>
      </div>
    </div>
  );
}
