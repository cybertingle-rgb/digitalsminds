import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { getGoogleStatus, getSmtpStatus } from "@/modules/settings/integrations";

export const metadata: Metadata = { title: "Overview" };

/** Live counts only. The full dashboard arrives in Phase 6. */
export default async function AdminOverview() {
  const user = await requirePagePermission("admin.access", "/admin");
  const [students, newInquiries, smtp, google] = await Promise.all([
    db().user.count({ where: { role: "STUDENT" } }),
    db().inquiry.count({ where: { status: "NEW" } }),
    getSmtpStatus(),
    getGoogleStatus(),
  ]);

  const cards = [
    { label: "Student accounts", value: String(students) },
    { label: "New inquiries", value: String(newInquiries) },
    { label: "Email sending", value: smtp.verifiedAt ? "Working" : smtp.configured ? "Not tested" : "Not set up" },
    { label: "Google sign-in", value: google.enabled ? "On" : google.configured ? "Not enabled" : "Not set up" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Welcome, {user.name}</h1>
        <p className="mt-1 text-muted">Here is the current state of the platform.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label} className="rounded-xl border border-line bg-white p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-charcoal-900">{c.value}</p>
          </li>
        ))}
      </ul>
      {can(user.role, "integrations.manage") && (!smtp.verifiedAt || !google.enabled) && (
        <div className="rounded-xl border border-sun-400 bg-sun-50 p-5">
          <h2 className="font-semibold text-charcoal-900">Finish setting up</h2>
          <p className="mt-1 text-sm text-charcoal-800">
            Students need email to verify their accounts and reset passwords. Set up email (and optionally Google sign-in) in{" "}
            <Link href="/admin/integrations" className="font-semibold underline underline-offset-4">
              Integrations
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
