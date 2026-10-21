"use server";

import { z } from "zod";
import { AdmissionError, closeApplication, moveApplication, rejectPayment, resendLinkAsStaff, verifyInput, verifyPayment } from "@/modules/admissions/service";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";

export type AppState = { status: "idle" | "success" | "error"; message?: string };

const id = z.string().min(1).max(64);

/** No revalidation: the result stays on screen; admin pages are dynamic, so they're fresh on the next visit. */
async function run(fn: (actor: CurrentUser) => Promise<string>): Promise<AppState> {
  try {
    const actor = await assertPermission("applications.view");
    return { status: "success", message: await fn(actor) };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof AdmissionError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: e.issues[0]?.message ?? "Please check the details and try again." };
    console.error("[applications] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function verifyPaymentAction(paymentId: string, amountReceivedPkr: string): Promise<AppState> {
  return run(async (actor) => {
    const r = await verifyPayment(id.parse(paymentId), verifyInput.parse({ amountReceivedPkr }), actor);
    return r.newAccount
      ? "Payment verified. The seat is reserved, the student account was created and the student has been emailed a link to set their password."
      : "Payment verified. The seat is reserved and the student's existing account is active again; they've been emailed.";
  });
}

export async function rejectPaymentAction(paymentId: string, note: string): Promise<AppState> {
  return run(async (actor) => {
    await rejectPayment(id.parse(paymentId), z.string().max(1000).parse(note), actor);
    return "Payment rejected. The applicant has been emailed your reason and can send the details again.";
  });
}

export async function moveApplicationAction(applicationId: string, batchId: string): Promise<AppState> {
  return run(async (actor) => {
    await moveApplication(id.parse(applicationId), id.parse(batchId), actor);
    return "Moved to the new batch.";
  });
}

export async function closeApplicationAction(applicationId: string, outcome: string, note: string): Promise<AppState> {
  return run(async (actor) => {
    const o = z.enum(["REJECTED", "CANCELLED"]).parse(outcome);
    await closeApplication(id.parse(applicationId), o, z.string().max(1000).parse(note), actor);
    return o === "REJECTED" ? "Application rejected. The applicant has been emailed." : "Application cancelled. The applicant has been emailed.";
  });
}

export async function resendLinkAction(applicationId: string): Promise<AppState> {
  return run(async (actor) => {
    await resendLinkAsStaff(id.parse(applicationId), actor);
    return "A new link was emailed to the applicant. Earlier links stop working.";
  });
}
