"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { EnrollmentError, manualEnroll } from "@/modules/learning/enrollment";
import { deleteStudent, setStudentSuspended, StudentError, studentEditInput, updateStudent } from "@/modules/students/service";

export type StudentState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

async function run(permission: Permission, studentId: string, fn: (actor: CurrentUser, id: string) => Promise<string>): Promise<StudentState> {
  try {
    const actor = await assertPermission(permission);
    const message = await fn(actor, z.string().min(1).max(64).parse(studentId));
    revalidatePath(`/admin/students/${studentId}`);
    return { status: "success", message };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StudentError || e instanceof EnrollmentError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[students] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function updateStudentAction(id: string, _prev: StudentState, fd: FormData): Promise<StudentState> {
  return run("students.manage", id, async (actor, studentId) => {
    const input = studentEditInput.parse(Object.fromEntries(["name", "googleEmail", "phone", "city"].map((k) => [k, String(fd.get(k) ?? "")])));
    await updateStudent(studentId, input, actor);
    return "Details saved.";
  });
}

export async function suspendStudentAction(id: string, suspended: boolean, reason: string): Promise<StudentState> {
  return run("students.manage", id, async (actor, studentId) => {
    await setStudentSuspended(studentId, suspended === true, z.string().max(500).parse(reason).trim() || null, actor);
    return suspended ? "Account suspended and signed out everywhere." : "Account reactivated.";
  });
}

export async function manualEnrollAction(id: string, _prev: StudentState, fd: FormData): Promise<StudentState> {
  return run("enrollments.decide", id, async (actor, studentId) => {
    const courseId = z.string().min(1, "Choose a course").max(64).parse(String(fd.get("courseId") ?? ""));
    await manualEnroll(studentId, courseId, actor);
    return "Enrolled. The student has been emailed.";
  });
}

export async function deleteStudentAction(id: string, confirmEmail: string): Promise<StudentState> {
  try {
    const actor = await assertPermission("students.delete");
    await deleteStudent(z.string().min(1).max(64).parse(id), z.string().max(254).parse(confirmEmail), actor);
    revalidatePath("/admin/students");
    return { status: "success", message: "Account deleted." };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StudentError) return { status: "error", message: e.message };
    console.error("[students] delete failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
