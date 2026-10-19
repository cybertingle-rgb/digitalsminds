import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

type Props = { title: string; text: string; href: string; label: string };

export function CtaBanner({ title, text, href, label }: Props) {
  return (
    <Section tone="dark">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
          <p className="mt-3 text-charcoal-200">{text}</p>
        </div>
        <LinkButton href={href}>{label}</LinkButton>
      </div>
    </Section>
  );
}
