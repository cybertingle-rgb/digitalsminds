"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-4 text-muted">Please try again. If the problem continues, contact us.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">Go home</LinkButton>
      </div>
    </Container>
  );
}
