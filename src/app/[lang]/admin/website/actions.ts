"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import type { Permission } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import {
  analyticsInput,
  contactInput,
  homeInput,
  legalInput,
  legalPages,
  logoInput,
  saveSetting,
  seoInput,
  seoPages,
  type LegalPage,
} from "@/modules/content/settings";
import { saveSocialLinks, socialInput } from "@/modules/settings/social";

export type WebsiteState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string>; redirectTo?: string };

/** Refreshes every public page now (they otherwise refresh within a minute). */
async function refreshSite() {
  revalidatePath("/[lang]", "layout");
}

async function run(permission: Permission, fn: (actor: CurrentUser) => Promise<string>): Promise<WebsiteState> {
  try {
    const actor = await assertPermission(permission);
    const message = await fn(actor);
    await refreshSite();
    return { status: "success", message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[issue.path.join(".")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[website] save failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

export async function saveSocialAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("content.manage", async (actor) => {
    const value = socialInput.parse({ facebook: str(fd, "facebook"), instagram: str(fd, "instagram"), linkedin: str(fd, "linkedin") });
    await saveSocialLinks(value, actor.id);
    await audit({ actorId: actor.id, action: "settings.social", entityType: "Setting", entityId: "site.social", metadata: value });
    return "Saved. The icons update on the website within a few minutes.";
  });
}

export async function saveHomeAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("content.manage", async (actor) => {
    const value = homeInput.parse({
      heroTitle: str(fd, "heroTitle"),
      heroTitleUr: str(fd, "heroTitleUr"),
      heroText: str(fd, "heroText"),
      heroTextUr: str(fd, "heroTextUr"),
      whyTitle: str(fd, "whyTitle"),
      whyTitleUr: str(fd, "whyTitleUr"),
      why: [0, 1, 2, 3].map((i) => ({
        title: str(fd, `why.${i}.title`),
        titleUr: str(fd, `why.${i}.titleUr`),
        text: str(fd, `why.${i}.text`),
        textUr: str(fd, `why.${i}.textUr`),
      })),
      ctaTitle: str(fd, "ctaTitle"),
      ctaTitleUr: str(fd, "ctaTitleUr"),
      ctaText: str(fd, "ctaText"),
      ctaTextUr: str(fd, "ctaTextUr"),
    });
    await saveSetting("site.home", value, actor.id);
    await audit({ actorId: actor.id, action: "content.home", entityType: "Setting", entityId: "site.home" });
    return "Homepage saved. It's live now.";
  });
}

export async function saveContactAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("content.manage", async (actor) => {
    const value = contactInput.parse({ email: str(fd, "email").trim().toLowerCase(), address: lines(str(fd, "address")), addressUr: lines(str(fd, "addressUr")) });
    await saveSetting("site.contact", value, actor.id);
    await audit({ actorId: actor.id, action: "content.contact", entityType: "Setting", entityId: "site.contact" });
    return "Contact details saved.";
  });
}

export async function saveSeoAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("content.manage", async (actor) => {
    const value = seoInput.parse(
      Object.fromEntries(
        seoPages.map((p) => [
          p,
          {
            title: str(fd, `${p}.title`),
            titleUr: str(fd, `${p}.titleUr`),
            description: str(fd, `${p}.description`),
            descriptionUr: str(fd, `${p}.descriptionUr`),
            imageId: str(fd, `${p}.imageId`),
          },
        ]),
      ),
    );
    for (const p of seoPages) {
      const id = value[p]?.imageId;
      if (id && !(await db().mediaAsset.findFirst({ where: { id, visibility: "PUBLIC", mimeType: { startsWith: "image/" } } }))) {
        throw new z.ZodError([{ code: "custom", path: [p, "imageId"], message: "Choose a public image from the Media library", input: id }]);
      }
    }
    await saveSetting("site.seo", value, actor.id);
    await audit({ actorId: actor.id, action: "content.seo", entityType: "Setting", entityId: "site.seo" });
    return "Search settings saved.";
  });
}

export async function saveLegalAction(page: LegalPage, _prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("content.manage", async (actor) => {
    const which = z.enum(legalPages).parse(page);
    const value = legalInput.parse({
      title: str(fd, "title"),
      titleUr: str(fd, "titleUr"),
      body: str(fd, "body"),
      bodyUr: str(fd, "bodyUr"),
      published: fd.get("published") === "on",
    });
    await saveSetting(`page.${which}`, { ...value, updatedAt: new Date().toISOString() }, actor.id);
    await audit({ actorId: actor.id, action: "content.legal", entityType: "Setting", entityId: `page.${which}`, metadata: { published: value.published } });
    return value.published ? "Saved and published." : "Saved as a draft (not shown on the website).";
  });
}

/** Replace (or reset) the logo. Super Admin only. */
export async function saveLogoAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("settings.manage", async (actor) => {
    const value = logoInput.parse({ lightId: str(fd, "lightId") || null, darkId: str(fd, "darkId") || null });
    for (const [k, id] of Object.entries(value)) {
      if (!id) continue;
      const a = await db().mediaAsset.findUnique({ where: { id } });
      if (!a || a.visibility !== "PUBLIC" || !a.mimeType.startsWith("image/") || !a.width || !a.height) {
        throw new z.ZodError([{ code: "custom", path: [k], message: "Choose a public PNG, JPG or WebP image", input: id }]);
      }
    }
    await saveSetting("site.logo", value, actor.id);
    await audit({ actorId: actor.id, action: "content.logo", entityType: "Setting", entityId: "site.logo", metadata: value });
    return value.lightId || value.darkId ? "Logo updated across the site." : "Back to the official logo.";
  });
}

export async function saveAnalyticsAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run("settings.manage", async (actor) => {
    const value = analyticsInput.parse({ gaId: str(fd, "gaId"), googleVerification: str(fd, "googleVerification") });
    await saveSetting("site.analytics", value, actor.id);
    await audit({ actorId: actor.id, action: "settings.analytics", entityType: "Setting", entityId: "site.analytics", metadata: { gaId: value.gaId, verification: Boolean(value.googleVerification) } });
    return value.gaId ? "Saved. Visitors who accept analytics cookies are now counted in Google Analytics." : "Saved. Google Analytics is off.";
  });
}
