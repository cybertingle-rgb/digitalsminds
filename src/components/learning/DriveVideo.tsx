import { driveEmbedUrl, driveFileId, driveViewUrl } from "@/modules/courses/drive";

/** Embedded Google Drive player with an always-visible "Open in Google Drive" fallback. */
export function DriveVideo({ url, title, openLabel, help }: { url: string; title: string; openLabel: string; help?: string }) {
  const id = driveFileId(url);
  if (!id) return null;
  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-charcoal-900">
        <iframe
          src={driveEmbedUrl(id)}
          title={title}
          allow="autoplay; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <a
          href={driveViewUrl(id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 rounded-lg border border-charcoal-200 bg-white px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-charcoal-50"
        >
          {openLabel}
        </a>
        {help && <p className="min-w-0 flex-1 text-xs text-muted">{help}</p>}
      </div>
    </div>
  );
}
