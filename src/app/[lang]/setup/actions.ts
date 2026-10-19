"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { createSuperAdmin, setupInput } from "@/modules/auth/setup";

export type SetupState = { error?: string; fields?: Record<string, string> };

// Slows down guessing of the setup code.
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

export async function setupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  if (!limiter(clientIp(await headers())).allowed) return { error: "Too many attempts. Please wait 15 minutes." };

  const parsed = setupInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { fields };
  }
  const result = await createSuperAdmin(parsed.data);
  if (!result.ok) return { error: result.error };
  redirect("/login?setup=1&next=%2Fadmin%2Fintegrations");
}
