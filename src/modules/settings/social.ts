import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { SocialPlatform } from "./social-types";

/** Social profile links, editable in Admin → Website. Only official profile URLs are accepted. */
const KEY = "site.social";

export const socialPlatforms: readonly SocialPlatform[] = ["facebook", "instagram", "linkedin"];

const hosts: Record<SocialPlatform, RegExp> = {
  facebook: /^(www\.|m\.|web\.)?(facebook\.com|fb\.com)$/,
  instagram: /^(www\.)?instagram\.com$/,
  linkedin: /^([a-z]{2,3}\.|www\.)?linkedin\.com$/,
};

const profileUrl = (platform: SocialPlatform) =>
  z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .refine(
      (v) => {
        if (v === null) return true;
        try {
          const u = new URL(v);
          return u.protocol === "https:" && hosts[platform].test(u.hostname) && u.pathname.length > 1;
        } catch {
          return false;
        }
      },
      { message: `Paste the full https:// link to your ${platform[0]!.toUpperCase()}${platform.slice(1)} page` },
    );

export const socialInput = z.object({
  facebook: profileUrl("facebook"),
  instagram: profileUrl("instagram"),
  linkedin: profileUrl("linkedin"),
});
export type SocialLinks = z.infer<typeof socialInput>;

const stored = z.object({ facebook: z.string().nullable(), instagram: z.string().nullable(), linkedin: z.string().nullable() });

export async function getSocialLinks(): Promise<SocialLinks> {
  try {
    const row = await db().siteSetting.findUnique({ where: { key: KEY } });
    const parsed = stored.safeParse(row?.value);
    if (parsed.success) return parsed.data;
  } catch {
    // Database unavailable: show no links rather than failing the page.
  }
  return { facebook: null, instagram: null, linkedin: null };
}

export async function saveSocialLinks(value: SocialLinks, actorId: string) {
  await db().siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: actorId }, update: { value, updatedById: actorId } });
}
