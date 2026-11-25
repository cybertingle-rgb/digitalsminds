import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:opacity-60";

const variants: Record<Variant, string> = {
  /** Brand orange with black text (8.4:1). Main call to action, on light or dark backgrounds. */
  primary:
    "bg-sun-400 text-charcoal-950 shadow-[0_8px_22px_-12px_rgb(232_98_16/0.85)] hover:-translate-y-px hover:bg-sun-500 hover:shadow-[0_12px_28px_-12px_rgb(232_98_16/0.9)] focus-visible:outline-charcoal-950",
  secondary:
    "border border-charcoal-200 bg-white text-charcoal-900 shadow-sm hover:-translate-y-px hover:border-sun-400 hover:shadow-[0_10px_24px_-14px_rgb(17_17_17/0.35)]",
  dark: "bg-charcoal-950 text-white shadow-[0_8px_22px_-12px_rgb(0_0_0/0.8)] hover:bg-charcoal-800",
  ghost: "text-charcoal-900 underline-offset-4 hover:underline",
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
