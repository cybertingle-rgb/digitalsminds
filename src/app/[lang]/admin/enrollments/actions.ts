"use server";

import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { decideEnrollment, EnrollmentError } from "@/modules/learning/enrollment";

export type DecisionState = { status: "success" | "error"; message: string };

const input = z.object({
  id: z.string().min(1).max(64),
  decision: z.enum(["APPROVED", "REJECTED", "REVOKED"]),
  note: z.string().trim().max(1000).transform((v) => v || null),
});

export async function decideAction(id: string, decision: "APPROVED" | "REJECTED" | "REVOKED", note: string): Promise<DecisionState> {
  try {
    const actor = await assertPermission("enrollments.decide");
    const v = input.parse({ id, decision, note });
    await decideEnrollment(v.id, v.decision, v.note, actor);
    // No revalidation: the row stays in place showing its confirmation; admin pages are dynamic,
    // so counts are fresh on the next page load.
    return {
      status: "success",
      message: { APPROVED: "Approved. The student has been emailed.", REJECTED: "Rejected. The student has been emailed.", REVOKED: "Access revoked." }[v.decision],
    };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof EnrollmentError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: "Please keep the note under 1000 characters." };
    console.error("[enrollment] decision failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
