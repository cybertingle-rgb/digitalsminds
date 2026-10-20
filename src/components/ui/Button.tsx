import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:opacity-60";

const variants: Record<Variant, string> = {
  /** Brand yellow with charcoal text (8.7:1). Main call to action, on light or dark backgrounds. */
  primary:
    "bg-gradient-to-b from-sun-200 via-sun-400 to-sun-400 text-charcoal-900 shadow-[0_8px_22px_-10px_rgb(244_192_26/0.9)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgb(253_207_49/0.6),0_12px_32px_-8px_rgb(244_192_26/0.95)]",
  secondary:
    "border border-white/80 bg-white/60 text-charcoal-900 shadow-sm backdrop-blur hover:-translate-y-px hover:bg-white/90 hover:shadow-[0_0_0_1px_rgb(253_207_49/0.35),0_12px_30px_-10px_rgb(253_207_49/0.7)]",
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
