import type { DeepPartial } from "../types";
import type { Dictionary } from "./en";

/**
 * Urdu text, supplied by Digitals Minds.
 *
 * Mirror the structure of en.ts and translate values only (keep keys and
 * {placeholders} unchanged). Anything left out falls back to English.
 * Lists (e.g. offerings) must be translated as a whole list.
 *
 * Example:
 *   nav: { home: "...", about: "..." },
 *
 * Once the translation is complete, set `features.urduPublic` to true in
 * src/config/features.ts to show the language switcher and let search
 * engines index the Urdu pages.
 */
export const ur: DeepPartial<Dictionary> = {};
