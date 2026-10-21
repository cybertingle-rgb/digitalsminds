"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { archiveItem, createItem, deleteDocument, itemInput, OnboardingError, setDocumentPublished, updateItem } from "@/modules/onboarding/service";

export type OnboardingState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

async function run(fn: (actor: CurrentUser) => Promise<string>, path: string): Promise<OnboardingState> {
  try {
    const actor = await assertPermission("onboarding.manage");
    const message = await fn(actor);
    revalidatePath(path);
    return { status: "success", message };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof OnboardingError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[onboarding] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const read = (fd: FormData) =>
  itemInput.parse({
    scope: String(fd.get("scope") ?? ""),
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    required: fd.get("required") === "on",
    studentCompletes: fd.get("studentCompletes") === "on",
    position: String(fd.get("position") ?? "0") || "0",
  });

const id = z.string().min(1).max(64);

export async function createItemAction(_prev: OnboardingState, fd: FormData): Promise<OnboardingState> {
  return run(async (actor) => {
    await createItem(read(fd), actor);
    return "Step added. Students it applies to see it in their onboarding checklist.";
  }, "/admin/onboarding");
}

export async function updateItemAction(itemId: string, _prev: OnboardingState, fd: FormData): Promise<OnboardingState> {
  return run(async (actor) => {
    await updateItem(id.parse(itemId), read(fd), actor);
    return "Saved.";
  }, "/admin/onboarding");
}

export async function archiveItemAction(itemId: string): Promise<OnboardingState> {
  return run(async (actor) => {
    await archiveItem(id.parse(itemId), actor);
    return "Step removed from checklists.";
  }, "/admin/onboarding");
}

export async function setDocumentPublishedAction(docId: string, published: boolean): Promise<OnboardingState> {
  return run(async (actor) => {
    await setDocumentPublished(id.parse(docId), published === true, actor);
    return published ? "Shown to students." : "Hidden from students.";
  }, "/admin/documents");
}

export async function deleteDocumentAction(docId: string): Promise<OnboardingState> {
  return run(async (actor) => {
    await deleteDocument(id.parse(docId), actor);
    return "Document deleted.";
  }, "/admin/documents");
}
