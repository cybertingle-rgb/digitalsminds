"use server";

import { z } from "zod";
import type { EnrollmentStage } from "@/generated/prisma/client";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { confirmOnboardingItem, EnrollmentAdminError, setStage, transfer } from "@/modules/enrollments/service";

export type RosterState = { status: "idle" | "success" | "error"; message?: string };

const id = z.string().min(1).max(64);
const STAGES = ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE", "COMPLETED", "WITHDRAWN"] as const satisfies readonly EnrollmentStage[];

/** No revalidation: the result stays on screen; the page is dynamic, so it's fresh on the next visit. */
async function run(fn: (actor: CurrentUser) => Promise<string>): Promise<RosterState> {
  try {
    const actor = await assertPermission("admin.access");
    return { status: "success", message: await fn(actor) };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof EnrollmentAdminError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: "Please check the details and try again." };
    console.error("[roster] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function setStageAction(enrollmentId: string, stage: string, note: string): Promise<RosterState> {
  return run(async (actor) => {
    await setStage(id.parse(enrollmentId), z.enum(STAGES).parse(stage), z.string().max(1000).parse(note) || null, actor);
    return "Updated. The student has been notified.";
  });
}

export async function transferAction(enrollmentId: string, batchId: string, note: string): Promise<RosterState> {
  return run(async (actor) => {
    await transfer(id.parse(enrollmentId), id.parse(batchId), z.string().max(500).parse(note) || null, actor);
    return "Transferred. The student has been notified.";
  });
}

export async function confirmStepAction(enrollmentId: string, itemId: string, done: boolean): Promise<RosterState> {
  return run(async (actor) => {
    await confirmOnboardingItem(id.parse(enrollmentId), id.parse(itemId), done === true, actor);
    return done ? "Step confirmed." : "Step unconfirmed.";
  });
}
