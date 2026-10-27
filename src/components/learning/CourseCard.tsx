import Link from "next/link";
import type { ReactNode } from "react";
import { formatPkr } from "@/modules/payments/format";

/** Catalogue / dashboard card with thumbnail. Text is passed in already localized. */
export function CourseCard(props: {
  href: string;
  title: string;
  summary?: string;
  thumbnailUrl: string | null;
  meta: (string | null)[];
  /** Fee in PKR paisa. */
  fee?: number | null;
  courseLang: "en" | "ur";
  footer?: ReactNode;
}) {
  return (
    <article className="glass glow-card flex h-full flex-col rounded-3xl">
      <div className="relative aspect-video bg-charcoal-100">
        {props.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-charcoal-800 to-charcoal-900">
            <span className="absolute bottom-3 start-4 text-sm font-semibold text-sun-400">Digitals Minds</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-charcoal-900" dir="auto">
          <Link href={props.href} className="after:absolute after:inset-0 focus:outline-none">
            <span className="relative">{props.title}</span>
          </Link>
        </h2>
        {props.summary && <p className="mt-2 line-clamp-3 text-sm text-muted" dir="auto">{props.summary}</p>}
        <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-xs font-medium text-charcoal-700">
          {props.fee ? <span className="text-charcoal-900" dir="ltr">{formatPkr(props.fee)}</span> : null}
          {props.meta.filter(Boolean).map((m) => <span key={m}>{m}</span>)}
        </p>
        {props.footer && <div className="relative z-10 mt-4">{props.footer}</div>}
      </div>
    </article>
  );
}
