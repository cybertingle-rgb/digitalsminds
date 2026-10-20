"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { CertificateError, issueCertificate, revokeCertificate } from "@/modules/certificates/service";

export type CertState = { status: "success" | "error"; message: string };

function failure(e: unknown): CertState {
  if (e instanceof ForbiddenError || e instanceof CertificateError) return { status: "error", message: e.message };
  console.error("[certificates] action failed", e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

export async function issueAction(enrollmentId: string): Promise<CertState> {
  try {
    const actor = await assertPermission("certificates.issue");
    const cert = await issueCertificate(z.string().min(1).max(64).parse(enrollmentId), actor);
    return { status: "success", message: `Issued ${cert.code}. The student has been emailed.` };
  } catch (e) {
    return failure(e);
  }
}

export async function revokeAction(id: string): Promise<CertState> {
  try {
    const actor = await assertPermission("certificates.issue");
    await revokeCertificate(z.string().min(1).max(64).parse(id), actor);
    revalidatePath("/admin/certificates");
    return { status: "success", message: "Certificate revoked. Its link now shows it is no longer valid." };
  } catch (e) {
    return failure(e);
  }
}
