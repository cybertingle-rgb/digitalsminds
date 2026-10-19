import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Container className="py-24 text-center">
          <p className="text-sm font-semibold text-brand-600">404</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Page not found</h1>
          <p className="mt-4 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href="/">Go home</LinkButton>
            <LinkButton href="/contact" variant="secondary">Contact us</LinkButton>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
