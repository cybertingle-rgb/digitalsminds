import "server-only";
import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";

/**
 * Site text. The Urdu interface was removed (owner request, 2026-10-21), so
 * every visitor and every email gets English, whatever language was saved.
 * The Urdu draft stays in ./dictionaries/ur.ts in case it returns.
 */
export function getDictionary(locale: Locale): Dictionary {
  void locale;
  return en;
}

export type { Dictionary };
