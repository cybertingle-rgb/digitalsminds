import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { inputClass } from "@/components/forms/Field";
import { siteConfig } from "@/config/site";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { canUseMediaLibrary, listAssets, mediaUrl } from "@/modules/media/service";
import { getStorageStatus } from "@/modules/media/storage-check";
import { extensionOf } from "@/modules/media/validate";
import { MediaGrid, type MediaItem } from "./MediaGrid";
import { MediaUploader } from "./MediaUploader";

export const metadata: Metadata = { title: "Media" };

const PAGE_SIZE = 24;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function MediaPage({ searchParams }: PageProps<"/[lang]/admin/media">) {
  const user = await requirePagePermission("admin.access", "/admin/media");
  if (!canUseMediaLibrary(user)) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const type = sp.type === "image" || sp.type === "document" ? sp.type : undefined;
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));

  const [storage, { items, total }] = await Promise.all([getStorageStatus(), listAssets(user, { q, type, page, pageSize: PAGE_SIZE })]);
  const media: MediaItem[] = items.map((a) => ({
    id: a.id,
    name: a.originalName,
    url: mediaUrl(a),
    isImage: a.mimeType.startsWith("image/"),
    ext: extensionOf(a.storageKey),
    size: a.sizeBytes,
    width: a.width,
    height: a.height,
    visibility: a.visibility,
    altText: a.altText ?? "",
    altTextUr: a.altTextUr ?? "",
    uploadedBy: a.uploadedBy?.name ?? "Deleted user",
    uploadedAt: dateFmt.format(a.createdAt),
  }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/admin/media?${new URLSearchParams({ ...(q && { q }), ...(type && { type }), page: String(p) })}`;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Media</h1>
        <p className="mt-1 text-muted">
          {can(user.role, "media.manage.all") ? "All uploaded files." : "Files you have uploaded."} Videos stay on Google Drive and are added to lessons directly.
        </p>
      </div>

      {storage.uploadsEnabled ? (
        <MediaUploader />
      ) : (
        <div role="status" className="rounded-2xl border border-sun-400 bg-sun-50 p-6 text-sm text-charcoal-900">
          <p className="font-semibold">Uploads are switched off until file storage is confirmed.</p>
          <p className="mt-1">
            {storage.problem ??
              "The site needs to see that uploaded files survive a redeploy, so nothing you upload can be lost."}{" "}
            {can(user.role, "integrations.manage") ? (
              <Link href="/admin/integrations#storage" className="font-semibold underline underline-offset-4">Open File storage</Link>
            ) : (
              "A Super Admin can complete this in Integrations."
            )}
          </p>
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="File name or description" className={`${inputClass} w-64`} />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-charcoal-900">Type</label>
          <select id="type" name="type" defaultValue={type ?? ""} className={inputClass}>
            <option value="">All files</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg border border-charcoal-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-charcoal-50">Filter</button>
        <p className="ms-auto text-sm text-muted">{total} file{total === 1 ? "" : "s"}</p>
      </form>

      <MediaGrid items={media} siteUrl={siteConfig.url} />

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="underline underline-offset-4">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="underline underline-offset-4">Next</Link>}
        </nav>
      )}
    </div>
  );
}
