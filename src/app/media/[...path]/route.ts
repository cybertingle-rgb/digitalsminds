import { db } from "@/lib/db";
import { fileResponse } from "@/modules/media/serve";

/** Public uploads (logos, thumbnails, blog images). Only files marked PUBLIC are served here. */
export async function GET(_req: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const storageKey = `public/${path.join("/")}`;
  const asset = await db().mediaAsset.findUnique({ where: { storageKey } });
  if (!asset || asset.visibility !== "PUBLIC") return new Response("Not found", { status: 404 });
  // Keys are unique per upload (a replaced file gets a new key), so these can be cached forever.
  return fileResponse(asset, { cacheControl: "public, max-age=31536000, immutable" });
}
