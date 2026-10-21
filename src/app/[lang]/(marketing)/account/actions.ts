"use server";

import { revalidatePath } from "next/cache";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentUser } from "@/modules/auth/session";
import { profileInput, updateProfile } from "@/modules/learning/profile";
import { PortalError, setOnboardingItem } from "@/modules/portal/service";
import { z } from "zod";

export type ProfileState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

export async function saveProfileAction(lang: string, _prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const locale = hasLocale(lang) ? lang : "en";
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: dict.auth.errors.generic };
  const parsed = profileInput.safeParse(Object.fromEntries(["name", "googleEmail", "phone", "city", "preferredLocale"].map((k) => [k, String(fd.get(k) ?? "")])));
  if (!parsed.success) {
    const e = dict.auth.errors;
    const messages: Record<string, string> = { name: e.name, googleEmail: e.googleEmail, phone: e.phone, city: e.city, preferredLocale: e.generic };
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      errors[key] = messages[key] ?? e.generic;
    }
    return { status: "error", errors };
  }
  await updateProfile(user.id, parsed.data);
  revalidatePath(localizePath("/account", locale), "layout");
  return { status: "success", message: dict.account.profileSaved };
}

export type ChecklistState = { status: "idle" | "success" | "error"; message?: string };

/** The student ticks or unticks one of their onboarding steps. */
export async function setOnboardingAction(lang: string, enrollmentId: string, itemId: string, done: boolean): Promise<ChecklistState> {
  const locale = hasLocale(lang) ? lang : "en";
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: dict.auth.errors.generic };
  try {
    await setOnboardingItem(user.id, z.string().min(1).max(64).parse(enrollmentId), z.string().min(1).max(64).parse(itemId), done === true);
  } catch (e) {
    if (!(e instanceof PortalError) && !(e instanceof z.ZodError)) console.error("[portal] onboarding update failed", e);
    return { status: "error", message: dict.auth.errors.generic };
  }
  revalidatePath(localizePath("/account", locale), "layout");
  return { status: "success" };
}
