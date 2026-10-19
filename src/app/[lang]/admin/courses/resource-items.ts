import "server-only";
import { mediaUrl } from "@/modules/media/service";
import type { ResourceItem } from "./Resources";

type WithMedia = { id: string; title: string; kind: "FILE" | "LINK"; url: string | null; mediaAsset: { id: string; originalName: string; storageKey: string; visibility: string } | null };

export function resourceItems(resources: WithMedia[]): ResourceItem[] {
  return resources.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    href: r.mediaAsset ? mediaUrl(r.mediaAsset) : (r.url ?? "#"),
    detail: r.mediaAsset ? r.mediaAsset.originalName : (r.url ?? ""),
    isPrivate: r.mediaAsset?.visibility === "PRIVATE",
  }));
}
