import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2";
};

export function SectionHeading({ eyebrow, title, description, align = "start", as: Tag = "h2" }: Props) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      {eyebrow && (
        <p className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-700 ${align === "center" ? "justify-center" : ""}`}>
          <span aria-hidden="true" className="h-1 w-6 rounded-full bg-sun-400" />
          {eyebrow}
        </p>
      )}
      <Tag className="mt-3 text-3xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-4xl">{title}</Tag>
      {description && <div className="mt-4 text-lg text-muted text-pretty">{description}</div>}
    </div>
  );
}
