import type { ReactNode } from "react";
import { Container } from "./Container";

type Props = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "alt" | "brand";
  className?: string;
};

const tones = {
  default: "bg-surface",
  alt: "bg-surface-alt",
  brand: "bg-brand-950 text-white",
};

export function Section({ children, id, tone = "default", className = "" }: Props) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${tones[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
