"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { BatchError, batchInput, createBatch, updateBatch } from "@/modules/batches/service";

export type BatchState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

async function run(fn: (actor: CurrentUser) => Promise<string>): Promise<BatchState> {
  try {
    const actor = await assertPermission("batches.manage");
    const message = await fn(actor);
    revalidatePath("/admin/batches", "layout");
    return { status: "success", message };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof BatchError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[batches] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const read = (fd: FormData) => batchInput.parse(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])));

export async function createBatchAction(_prev: BatchState, fd: FormData): Promise<BatchState> {
  let id = "";
  const state = await run(async (actor) => {
    id = (await createBatch(read(fd), actor)).id;
    return "Batch created.";
  });
  if (state.status === "success") redirect(`/admin/batches/${id}?created=1`);
  return state;
}

export async function updateBatchAction(id: string, _prev: BatchState, fd: FormData): Promise<BatchState> {
  return run(async (actor) => {
    await updateBatch(z.string().min(1).max(64).parse(id), read(fd), actor);
    return "Saved.";
  });
}
