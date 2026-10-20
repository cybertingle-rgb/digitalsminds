"use client";

import { useEffect, useState } from "react";
import { isStaleDeployment, reloadOnce } from "@/components/errors/stale-deploy";

/** Errors inside the admin area (keeps the sidebar; shows a plain message and a reload). */
export default function AdminError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployment(error);
  const [reloading, setReloading] = useState(stale);

  useEffect(() => {
    console.error(error);
    // Reloading touches the browser (sessionStorage), so it can only run here; if it was refused, say so.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stale && !reloadOnce()) setReloading(false);
  }, [error, stale]);

  return (
    <div className="glass max-w-xl space-y-4 rounded-2xl p-6" role="alert">
      <h1 className="text-xl font-bold text-charcoal-900">{stale ? "The website was just updated" : "Something went wrong"}</h1>
      <p className="text-muted">
        {reloading
          ? "Reloading the page so you have the latest version…"
          : stale
            ? "This page was opened before the update. Reload it and try again."
            : "Nothing was lost. Reload the page and try again; if it keeps happening, check Activity or contact your developer."}
      </p>
      {error.digest && <p className="text-xs text-muted">Reference: <span dir="ltr">{error.digest}</span></p>}
      <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-charcoal-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-charcoal-800">
        Reload page
      </button>
    </div>
  );
}
