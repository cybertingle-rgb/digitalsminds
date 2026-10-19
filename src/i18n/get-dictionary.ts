import "server-only";
import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { ur } from "./dictionaries/ur";
import { mergeDictionary } from "./merge";

const cache = new Map<Locale, Dictionary>();

export function getDictionary(locale: Locale): Dictionary {
  const cached = cache.get(locale);
  if (cached) return cached;
  const dict = locale === "ur" ? mergeDictionary<Dictionary>(en, ur, true) : en;
  cache.set(locale, dict);
  return dict;
}

export type { Dictionary };
