"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/session";
import { canUseMediaLibrary, deleteAsset, MediaError, updateAltText } from "@/modules/media/service";

export type MediaActionState = { status: "success" | "error"; message: string };

async function withUser(fn: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<string>): Promise<MediaActionState> {
  const user = await getCurrentUser();
  if (!user || !canUseMediaLibrary(user)) return { status: "error", message: "You don't have permission to do that." };
  try {
    const message = await fn(user);
    revalidatePath("/admin/media");
    return { status: "success", message };
  } catch (e) {
    if (e instanceof MediaError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: "Invalid request." };
    console.error("[media] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

export async function deleteMediaAction(id: string): Promise<MediaActionState> {
  return withUser(async (user) => {
    await deleteAsset(z.string().max(64).parse(id), user);
    return "File deleted.";
  });
}

export async function updateAltAction(id: string, altText: string, altTextUr: string): Promise<MediaActionState> {
  return withUser(async (user) => {
    const s = z.string().max(255);
    await updateAltText(z.string().max(64).parse(id), s.parse(altText), s.parse(altTextUr), user);
    return "Description saved.";
  });
}
