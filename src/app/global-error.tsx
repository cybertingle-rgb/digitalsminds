"use client";

/** Last-resort boundary for errors in the root layout itself. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page or try again later.</p>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.75rem 1.25rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
