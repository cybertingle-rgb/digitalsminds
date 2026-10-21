import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { roleLabels, type Role } from "@/modules/auth/permissions";
import { actionEmail } from "@/modules/email/templates";

/** Roles that make someone part of the admin team. */
export const staffRoles = ["SUPER_ADMIN", "CONTENT_MANAGER", "INSTRUCTOR"] as const;
export type StaffRole = (typeof staffRoles)[number];

const INVITE_TTL_SECONDS = 60 * 60 * 24 * 3;

/** The person was saved, but the invitation email could not be sent. */
export class InviteEmailError extends Error {
  constructor(readonly cause: unknown) {
    super("Invitation email could not be sent");
    this.name = "InviteEmailError";
  }
}

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamError";
  }
}

export const inviteInput = z.object({
  name: z.string().trim().min(2, "Enter the person's name").max(120),
  email: z.email("Enter a valid email address").max(254).transform((v) => v.toLowerCase()),
  role: z.enum(staffRoles, { error: "Choose a role" }),
});

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  invitePending: boolean;
  isOwner: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
};

export async function listTeam(): Promise<TeamMember[]> {
  const users = await db().user.findMany({
    where: { role: { in: [...staffRoles] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      accounts: { select: { providerId: true } },
      sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    // Invited but hasn't set a password (or signed in with Google) yet.
    invitePending: u.accounts.length === 0,
    isOwner: u.email === siteConfig.superAdminEmail,
    createdAt: u.createdAt,
    lastActiveAt: u.sessions[0]?.updatedAt ?? null,
  }));
}

async function sendInvite(user: { id: string; name: string; email: string; role: Role }) {
  // Uses Better Auth's own reset-token storage, so the normal reset page sets the password.
  const ctx = await (await getAuth()).$context;
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: user.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000),
  });
  const dict = getDictionary("en");
  try {
    await sendMail(
      actionEmail({
        dict,
        locale: "en",
        to: user.email,
        name: user.name,
        subject: dict.emails.inviteSubject,
        intro: format(dict.emails.inviteIntro, { role: roleLabels[user.role] }),
        buttonLabel: dict.emails.inviteButton,
        url: `${siteConfig.url}/reset-password?token=${token}`,
      }),
    );
  } catch (e) {
    throw new InviteEmailError(e);
  }
}

/** Rules every change to a team member must pass. */
async function assertCanModify(targetId: string, actorId: string) {
  if (targetId === actorId) throw new TeamError("You can't change your own access. Ask another Super Admin.");
  const target = await db().user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true, status: true, name: true } });
  if (!target) throw new TeamError("This person no longer exists.");
  if (target.email === siteConfig.superAdminEmail) throw new TeamError("The owner account can't be changed or suspended.");
  return target;
}

async function assertNotLastSuperAdmin(target: { id: string; role: Role }) {
  if (target.role !== "SUPER_ADMIN") return;
  const others = await db().user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: target.id } } });
  if (others === 0) throw new TeamError("There must always be at least one active Super Admin.");
}

export async function inviteStaff(input: z.infer<typeof inviteInput>, actorId: string): Promise<{ promoted: boolean; resent?: boolean }> {
  const existing = await db().user.findUnique({ where: { email: input.email }, include: { accounts: { select: { id: true } } } });
  if (existing && existing.role !== "STUDENT") {
    if (existing.accounts.length > 0 || existing.status === "SUSPENDED") throw new TeamError("This person is already on the team.");
    // Invited before but never set a password (e.g. the first email failed): send the invitation again.
    await sendInvite(existing);
    await audit({ actorId, action: "team.invite_resent", entityType: "User", entityId: existing.id });
    return { promoted: false, resent: true };
  }

  if (existing) {
    // An existing student account: give it the staff role (they keep their login).
    if (existing.status === "SUSPENDED") throw new TeamError("This account is suspended. Reactivate it first.");
    await db().user.update({ where: { id: existing.id }, data: { role: input.role } });
    await audit({ actorId, action: "team.promote", entityType: "User", entityId: existing.id, metadata: { role: input.role } });
    return { promoted: true };
  }

  const user = await db().user.create({
    data: { id: randomUUID().replace(/-/g, ""), name: input.name, email: input.email, role: input.role, googleEmail: input.email },
  });
  await audit({ actorId, action: "team.invite", entityType: "User", entityId: user.id, metadata: { role: input.role, email: input.email } });
  await sendInvite(user);
  return { promoted: false };
}

export async function resendInvite(userId: string, actorId: string) {
  const user = await db().user.findUnique({ where: { id: userId }, include: { accounts: { select: { id: true } } } });
  if (!user || user.role === "STUDENT") throw new TeamError("This person is not on the team.");
  if (user.accounts.length > 0) throw new TeamError("This person has already set up their account.");
  await sendInvite(user);
  await audit({ actorId, action: "team.invite_resent", entityType: "User", entityId: user.id });
}

export async function changeRole(userId: string, role: StaffRole, actorId: string) {
  const target = await assertCanModify(userId, actorId);
  if (target.role === role) return;
  if (role !== "SUPER_ADMIN") await assertNotLastSuperAdmin(target);
  await db().user.update({ where: { id: userId }, data: { role } });
  await audit({ actorId, action: "team.role_changed", entityType: "User", entityId: userId, metadata: { from: target.role, to: role } });
}

/** Suspends (or reactivates) any non-owner account; suspension signs the person out everywhere. */
export async function setSuspended(userId: string, suspended: boolean, reason: string | null, actorId: string) {
  const target = await assertCanModify(userId, actorId);
  if (suspended) await assertNotLastSuperAdmin(target);
  await db().$transaction([
    db().user.update({
      where: { id: userId },
      data: suspended
        ? { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason?.slice(0, 500) || null }
        : { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
    }),
    ...(suspended ? [db().session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit({ actorId, action: suspended ? "user.suspend" : "user.reactivate", entityType: "User", entityId: userId, metadata: reason ? { reason } : undefined });
}

/** Removes admin access; the person keeps a normal student account. */
export async function removeFromTeam(userId: string, actorId: string) {
  const target = await assertCanModify(userId, actorId);
  await assertNotLastSuperAdmin(target);
  await db().$transaction([
    db().user.update({ where: { id: userId }, data: { role: "STUDENT" } }),
    db().courseInstructor.deleteMany({ where: { userId } }),
    // Sign them out so admin pages stop working immediately.
    db().session.deleteMany({ where: { userId } }),
  ]);
  await audit({ actorId, action: "team.removed", entityType: "User", entityId: userId, metadata: { previousRole: target.role } });
}
