import { getSocialLinks, socialPlatforms } from "@/modules/settings/social";

export const dynamic = "force-dynamic";

/** Social profile links for the (static) public pages, which load them in the browser. */
export async function GET() {
  const links = await getSocialLinks();
  const list = socialPlatforms.filter((p) => links[p]).map((p) => ({ platform: p, href: links[p]! }));
  return Response.json(list, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
