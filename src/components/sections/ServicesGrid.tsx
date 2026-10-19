import Link from "next/link";
import { services } from "@/content/services";

export function ServicesGrid() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <li key={s.slug}>
          <Link
            href={`/services/${s.slug}`}
            className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition hover:border-brand-200 hover:shadow-md"
          >
            <h3 className="text-lg font-semibold group-hover:text-brand-700">{s.title}</h3>
            <p className="mt-2 flex-1 text-muted">{s.summary}</p>
            <span className="mt-4 text-sm font-semibold text-brand-600">
              Learn more <span aria-hidden="true">→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
