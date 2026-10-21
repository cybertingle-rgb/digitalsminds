"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mailErrorMessage } from "@/lib/mailer";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { changeRole, InviteEmailError, inviteInput, inviteStaff, removeFromTeam, resendInvite, setSuspended, staffRoles, TeamError } from "@/modules/team/service";

export type TeamState = { status: "idle" | "success" | "error"; message?: string; fields?: Record<string, string> };

const PATH = "/admin/team";
const userId = z.string().min(1).max(64);

/** Runs a team change with the permission check and friendly error handling every action needs. */
async function run(fn: (actorId: string) => Promise<string>): Promise<TeamState> {
  let actor;
  try {
    actor = await assertPermission("staff.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    throw e;
  }
  try {
    const message = await fn(actor.id);
    revalidatePath(PATH);
    return { status: "success", message };
  } catch (e) {
    if (e instanceof TeamError) return { status: "error", message: e.message };
    if (e instanceof InviteEmailError) {
      console.error("[team] invitation email failed", e.cause);
      revalidatePath(PATH);
      return { status: "error", message: `The person is on the team list, but the invitation email couldn't be sent. ${mailErrorMessage(e.cause)} Fix it in Integrations → Email (use Send test email), then click “Resend invite”.` };
    }
    if (e instanceof z.ZodError) return { status: "error", message: "Invalid request." };
    console.error("[team] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function inviteAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const parsed = inviteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { status: "error", fields };
  }
  return run(async (actorId) => {
    const { promoted, resent } = await inviteStaff(parsed.data, actorId);
    if (promoted) return `${parsed.data.email} already had an account and now has team access.`;
    if (resent) return `${parsed.data.email} was already invited and hasn't set a password yet, so the invitation was sent again. The link is valid for 3 days.`;
    return `Invitation sent to ${parsed.data.email}. The link is valid for 3 days.`;
  });
}

export async function changeRoleAction(id: string, role: string): Promise<TeamState> {
  return run(async (actorId) => {
    await changeRole(userId.parse(id), z.enum(staffRoles).parse(role), actorId);
    return "Role updated.";
  });
}

export async function setSuspendedAction(id: string, suspended: boolean, reason?: string): Promise<TeamState> {
  return run(async (actorId) => {
    await setSuspended(userId.parse(id), suspended, z.string().max(500).optional().parse(reason) ?? null, actorId);
    return suspended ? "Account suspended and signed out everywhere." : "Account reactivated.";
  });
}

export async function removeAction(id: string): Promise<TeamState> {
  return run(async (actorId) => {
    await removeFromTeam(userId.parse(id), actorId);
    return "Admin access removed. The person keeps a normal student account.";
  });
}

export async function resendInviteAction(id: string): Promise<TeamState> {
  return run(async (actorId) => {
    await resendInvite(userId.parse(id), actorId);
    return "Invitation sent again.";
  });
}
