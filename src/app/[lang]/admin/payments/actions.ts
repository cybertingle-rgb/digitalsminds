"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { EnrollmentError } from "@/modules/learning/enrollment";
import { confirmPayment, paymentDetailsInput, PaymentError, rejectPayment, savePaymentDetails } from "@/modules/payments/service";

export type PaymentState = { status: "idle" | "success" | "error"; message?: string };

function failure(e: unknown, what: string): PaymentState {
  if (e instanceof ForbiddenError || e instanceof PaymentError || e instanceof EnrollmentError) return { status: "error", message: e.message };
  if (e instanceof z.ZodError) return { status: "error", message: "Please check the details and try again." };
  console.error(`[payments] ${what} failed`, e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

const id = z.string().min(1).max(64);

export async function confirmPaymentAction(paymentId: string): Promise<PaymentState> {
  try {
    const actor = await assertPermission("payments.manage");
    await confirmPayment(id.parse(paymentId), actor);
    // No revalidation: the confirmation stays on screen; admin pages are dynamic, so lists are fresh on the next visit.
    return { status: "success", message: "Payment confirmed. The course is open and the student has been emailed." };
  } catch (e) {
    return failure(e, "confirm");
  }
}

export async function rejectPaymentAction(paymentId: string, note: string): Promise<PaymentState> {
  try {
    const actor = await assertPermission("payments.manage");
    await rejectPayment(id.parse(paymentId), z.string().max(1000).parse(note), actor);
    // No revalidation: the confirmation stays on screen; admin pages are dynamic, so lists are fresh on the next visit.
    return { status: "success", message: "Payment rejected. The student has been emailed your reason and can send it again." };
  } catch (e) {
    return failure(e, "reject");
  }
}

export async function savePaymentDetailsAction(_prev: PaymentState, fd: FormData): Promise<PaymentState> {
  try {
    const actor = await assertPermission("payments.manage");
    const keys = ["bankName", "bankAccountTitle", "bankAccountNumber", "jazzcashTitle", "jazzcashNumber", "easypaisaTitle", "easypaisaNumber", "instructions", "instructionsUr", "bankQrId"] as const;
    const value = paymentDetailsInput.parse(Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")])));
    await savePaymentDetails(value, actor);
    revalidatePath("/admin/payments", "layout");
    return { status: "success", message: "Payment details saved. Students see them on the payment page." };
  } catch (e) {
    return failure(e, "details");
  }
}
