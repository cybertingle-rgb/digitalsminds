import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

/** Shared setup for auth pages: validated locale, dictionary, and noindex metadata. */
export async function authPage(params: Promise<{ lang: string }>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return { locale: lang as Locale, dict: getDictionary(lang) };
}

export const noindex: Metadata["robots"] = { index: false, follow: false };
