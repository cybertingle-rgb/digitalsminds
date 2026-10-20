"use client";

import { useEffect } from "react";
import { isStaleDeployment, reloadOnce } from "@/components/errors/stale-deploy";

/** Last-resort boundary for errors in the root layout itself. */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleDeployment(error)) reloadOnce();
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page or try again later.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.75rem 1.25rem" }}>
          Reload page
        </button>
      </body>
    </html>
  );
}
