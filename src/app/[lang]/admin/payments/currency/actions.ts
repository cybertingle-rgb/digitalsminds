"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { convertFlaggedPrice, CurrencyError, refreshRatesNow, saveCurrencySettings, settingsInput } from "@/modules/currency/service";
import { formatMoney } from "@/modules/currency/rules";

export type CurrencyState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

function failure(e: unknown): CurrencyState {
  if (e instanceof ForbiddenError || e instanceof CurrencyError) return { status: "error", message: e.message };
  if (e instanceof z.ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", errors };
  }
  console.error("[currency] action failed", e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

export async function saveCurrencyAction(_prev: CurrencyState, fd: FormData): Promise<CurrencyState> {
  try {
    const actor = await assertPermission("payments.manage");
    const manual: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("manual.") && typeof v === "string") manual[k.slice(7)] = v;
    const input = settingsInput.parse({
      provider: fd.get("provider"),
      apiKey: String(fd.get("apiKey") ?? "") || undefined,
      enabled: fd.getAll("enabled").map(String),
      maxAgeHours: fd.get("maxAgeHours"),
      refreshHours: fd.get("refreshHours"),
      manual,
    });
    await saveCurrencySettings(input, actor);
    // Rates are fetched again so a new provider or manual rate takes effect straight away.
    const r = await refreshRatesNow(actor);
    revalidatePath("/admin/payments/currency");
    return r.ok ? { status: "success", message: `Saved. ${r.count} rates updated.` } : { status: "error", message: `Saved, but the rates could not be updated: ${r.error}` };
  } catch (e) {
    return failure(e);
  }
}

export async function refreshNowAction(): Promise<CurrencyState> {
  try {
    const actor = await assertPermission("payments.manage");
    const r = await refreshRatesNow(actor);
    revalidatePath("/admin/payments/currency");
    return r.ok ? { status: "success", message: `${r.count} rates updated.` } : { status: "error", message: r.error };
  } catch (e) {
    return failure(e);
  }
}

export async function convertPriceAction(courseId: string): Promise<CurrencyState> {
  try {
    const actor = await assertPermission("payments.manage");
    const pkr = await convertFlaggedPrice(z.string().min(1).max(64).parse(courseId), actor);
    revalidatePath("/admin/payments/currency");
    revalidatePath("/[lang]", "layout");
    return { status: "success", message: `Converted: the fee is now ${formatMoney(pkr, "PKR")}.` };
  } catch (e) {
    return failure(e);
  }
}
