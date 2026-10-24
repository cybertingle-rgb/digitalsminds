"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AttendanceError, marksInput, saveAttendance } from "@/modules/attendance/service";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";

export type AttendanceState = { status: "idle" | "success" | "error"; message?: string };

export async function saveAttendanceAction(batchId: string, liveClassId: string, _prev: AttendanceState, fd: FormData): Promise<AttendanceState> {
  try {
    // Staff only; the service then checks this batch is one they manage or coordinate.
    const actor = await assertPermission("admin.access");
    const ids = fd.getAll("enrollmentId").map(String);
    const marks = marksInput.parse(ids.map((id) => ({ enrollmentId: id, status: String(fd.get(`status.${id}`) ?? ""), note: String(fd.get(`note.${id}`) ?? "") })));
    await saveAttendance(z.string().max(64).parse(batchId), z.string().max(64).parse(liveClassId), marks, actor);
    revalidatePath(`/admin/batches/${batchId}/attendance`);
    return { status: "success", message: "Attendance saved." };
  } catch (e) {
    if (e instanceof AttendanceError || e instanceof ForbiddenError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: "Please check the marks and try again." };
    console.error("[attendance] save failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
