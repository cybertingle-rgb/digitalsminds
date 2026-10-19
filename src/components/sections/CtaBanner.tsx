import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

type Props = { title?: string; text?: string; href?: string; label?: string };

export function CtaBanner({
  title = "Ready to grow your business?",
  text = "Tell us about your project and we'll get back to you with recommended next steps.",
  href = "/contact",
  label = "Send an Inquiry",
}: Props) {
  return (
    <Section tone="brand">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
          <p className="mt-3 text-brand-200">{text}</p>
        </div>
        <LinkButton href={href} variant="inverse">
          {label}
        </LinkButton>
      </div>
    </Section>
  );
}
