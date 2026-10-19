import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50",
  inverse: "bg-white text-brand-900 hover:bg-brand-50",
};

export function buttonClasses(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

type LinkButtonProps = { href: string; variant?: Variant; className?: string; children: ReactNode };

export function LinkButton({ href, variant = "primary", className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}
