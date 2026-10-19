import type { Metadata } from "next";
import { roleLabels } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { listTeam } from "@/modules/team/service";
import { InviteForm } from "./InviteForm";
import { TeamTable, type Member } from "./TeamTable";

export const metadata: Metadata = { title: "Team" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function TeamPage() {
  const user = await requirePagePermission("staff.manage", "/admin/team");
  const members: Member[] = (await listTeam()).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    roleLabel: roleLabels[m.role],
    status: m.status,
    invitePending: m.invitePending,
    isOwner: m.isOwner,
    isYou: m.id === user.id,
    lastActive: m.lastActiveAt ? dateFmt.format(m.lastActiveAt) : null,
  }));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Team</h1>
        <p className="mt-1 text-muted">
          <strong>Content Managers</strong> manage courses, website content, enrollments and inquiries. <strong>Instructors</strong> manage only the
          courses they are assigned to. <strong>Super Admins</strong> also manage the team, integrations and data exports.
        </p>
      </div>
      <InviteForm />
      <TeamTable members={members} />
    </div>
  );
}
