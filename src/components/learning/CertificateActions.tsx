"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CertificateActions({ labels }: { labels: { print: string; hint: string; share: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="print:hidden">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => window.print()}>{labels.print}</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the address bar still has the link.
            }
          }}
        >
          {copied ? labels.copied : labels.share}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{labels.hint}</p>
    </div>
  );
}
