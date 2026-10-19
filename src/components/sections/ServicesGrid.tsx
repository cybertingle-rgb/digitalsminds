import Link from "next/link";
import { Arrow } from "@/components/ui/Arrow";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ServicesGrid({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {getServices(dict).map((s) => (
        <li key={s.slug}>
          <Link
            href={localizePath(`/services/${s.slug}`, locale)}
            className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-sun-400 hover:shadow-md"
          >
            <span aria-hidden="true" className="mb-4 h-1 w-10 rounded-full bg-sun-400 transition-all group-hover:w-16" />
            <h3 className="text-lg font-semibold text-charcoal-900">{s.title}</h3>
            <p className="mt-2 flex-1 text-muted">{s.summary}</p>
            <span className="mt-4 text-sm font-semibold text-charcoal-900">
              {dict.common.learnMore} <Arrow />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
