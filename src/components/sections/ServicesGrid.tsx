import Link from "next/link";
import { Arrow } from "@/components/ui/Arrow";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** Division cards. `detailed` adds each division's "what's included" list (home page). */
export function ServicesGrid({ locale, dict, detailed = false }: { locale: Locale; dict: Dictionary; detailed?: boolean }) {
  return (
    <ul className={`grid gap-5 sm:grid-cols-2 ${detailed ? "lg:grid-cols-6" : "xl:grid-cols-3"}`}>
      {getServices(dict).map((s, i) => (
        <li key={s.slug} className={detailed ? (i < 2 ? "lg:col-span-3" : i === 4 ? "sm:col-span-2 lg:col-span-2" : "lg:col-span-2") : undefined}>
          <Link
            href={localizePath(`/services/${s.slug}`, locale)}
            className="glass glow-card group flex h-full flex-col rounded-3xl p-6 sm:p-7"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-200 to-sun-400 text-sm font-bold text-charcoal-900 shadow-[0_8px_20px_-8px_rgb(244_192_26/0.9)] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" dir="ltr">
                0{i + 1}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-sun-400/70 to-transparent rtl:bg-gradient-to-l" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-charcoal-900">{s.title}</h3>
            <p className="mt-2 text-charcoal-700">{s.summary}</p>
            {detailed && (
              <ul className={`mt-5 grid gap-2 text-sm text-charcoal-800 ${i < 2 ? "sm:grid-cols-2" : ""}`}>
                {s.offerings.slice(0, i < 2 ? 6 : 4).map((o) => (
                  <li key={o} className="flex gap-2">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sun-500" />
                    {o}
                  </li>
                ))}
              </ul>
            )}
            <span className="mt-auto pt-6 text-sm font-semibold text-charcoal-900">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-4 py-2 ring-1 ring-white transition-colors group-hover:bg-sun-400">
                {dict.common.learnMore} <Arrow />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
