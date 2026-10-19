import type { ReactNode } from "react";
import { Container } from "./Container";

type Props = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "alt" | "dark";
  className?: string;
};

const tones = {
  default: "bg-surface",
  alt: "bg-surface-alt",
  dark: "bg-charcoal-900 text-white",
};

export function Section({ children, id, tone = "default", className = "" }: Props) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${tones[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
