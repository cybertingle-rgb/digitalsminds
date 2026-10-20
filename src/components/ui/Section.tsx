import type { ReactNode } from "react";
import { Container } from "./Container";

type Props = {
  children: ReactNode;
  id?: string;
  tone?: "default" | "alt" | "dark";
  className?: string;
};

/**
 * Page section on the glass canvas. "alt" adds a faint frosted band;
 * "dark" puts the content in a yellow glass panel (calls to action).
 */
export function Section({ children, id, tone = "default", className = "" }: Props) {
  if (tone === "dark") {
    return (
      <section id={id} className={`py-10 sm:py-14 ${className}`}>
        <Container>
          <div className="glass-sun relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-12 sm:py-14">{children}</div>
        </Container>
      </section>
    );
  }
  const band = tone === "alt" ? "border-y border-white/60 bg-white/35" : "";
  return (
    <section id={id} className={`py-16 sm:py-20 ${band} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
