import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <Container className="py-20 sm:py-28">
        <p className="inline-flex rounded-full bg-white px-4 py-1 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
          {siteConfig.tagline}
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          {siteConfig.positioning}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted text-pretty">
          From your first idea to a growing brand: marketing, sourcing, media, business setup and
          e-commerce, all in one place at {siteConfig.name}.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton href="/contact">Get a Free Consultation</LinkButton>
          <LinkButton href="/services" variant="secondary">
            Explore Services
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
