import type { DeepPartial } from "./types";

// Unicode "left-to-right isolate" + "pop directional isolate": invisible marks
// that keep English fallback text (and its punctuation) readable inside an
// Urdu right-to-left page.
const LRI = "⁦";
const PDI = "⁩";

function isolate<T>(value: T): T {
  if (typeof value === "string") return `${LRI}${value}${PDI}` as T;
  if (Array.isArray(value)) return value.map(isolate) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, isolate(v)])) as T;
  }
  return value;
}

/**
 * Overlay a partial translation on the base dictionary. Missing entries use
 * the base text; with `isolateFallback`, those fallbacks are wrapped so they
 * render left-to-right inside a right-to-left page.
 */
export function mergeDictionary<T>(base: T, override: DeepPartial<T> | undefined, isolateFallback: boolean): T {
  if (override === undefined || override === null) return isolateFallback ? isolate(base) : base;
  if (typeof base === "string" || Array.isArray(base)) {
    return (override as T) ?? base;
  }
  if (base && typeof base === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base)) {
      out[key] = mergeDictionary(value, (override as Record<string, unknown>)[key] as DeepPartial<unknown>, isolateFallback);
    }
    return out as T;
  }
  return base;
}

/** Replace {placeholders}: format("Hello {name}", { name: "Ali" }). */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
