import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  /** Brand yellow with charcoal text (8.7:1). Main call to action, on light or dark backgrounds. */
  primary: "bg-sun-400 text-charcoal-900 shadow-[0_8px_22px_-10px_rgb(244_192_26/0.9)] hover:bg-sun-500",
  secondary: "border border-white/80 bg-white/60 text-charcoal-900 shadow-sm hover:bg-white/90",
  dark: "bg-charcoal-900 text-white shadow-[0_8px_22px_-12px_rgb(31_36_44/0.8)] hover:bg-charcoal-800",
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
