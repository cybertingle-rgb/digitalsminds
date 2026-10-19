import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
};

export function SectionHeading({ eyebrow, title, description, align = "left", as: Tag = "h2" }: Props) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      )}
      <Tag className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</Tag>
      {description && <div className="mt-4 text-lg text-muted text-pretty">{description}</div>}
    </div>
  );
}
