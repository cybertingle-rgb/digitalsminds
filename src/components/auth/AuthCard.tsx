import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="py-12 sm:py-16">
      <Container className="max-w-lg">
        <div className="glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-charcoal-900">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </Container>
    </section>
  );
}
