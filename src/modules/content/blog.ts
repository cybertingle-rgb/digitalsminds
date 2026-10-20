import "server-only";
import { z } from "zod";
import { getPosts as builtInPosts, type Block, type Post as FilePost } from "@/content/blog";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { slugify, slugSchema } from "@/modules/courses/schema";
import { mediaUrl } from "@/modules/media/service";

/**
 * Blog posts live in the database (Admin → Website → Blog). Until the first
 * post exists there, the built-in posts from src/content/blog.ts are shown, so
 * nothing disappears before the owner imports them.
 */

export type PublicPost = {
  slug: string;
  lang: "en" | "ur";
  title: string;
  excerpt: string;
  /** ISO date YYYY-MM-DD */
  publishedAt: string;
  author: string;
  tags: string[];
  /** Simple formatting (see RichText). */
  body: string;
  cover: { url: string; alt: string; width?: number; height?: number } | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
};

/** Built-in block content -> simple formatting text. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "h2" ? `## ${b.text}` : b.type === "ul" ? b.items.map((i) => `- ${i}`).join("\n") : b.text))
    .join("\n\n");
}

const fromFile = (p: FilePost): PublicPost => ({
  slug: p.slug,
  lang: p.lang,
  title: p.title,
  excerpt: p.excerpt,
  publishedAt: p.publishedAt,
  author: p.author,
  tags: p.tags,
  body: blocksToText(p.body),
  cover: null,
  seoTitle: null,
  seoDescription: null,
  updatedAt: null,
});

const tagsOf = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : []);

async function dbPostCount() {
  try {
    return await db().post.count();
  } catch {
    return 0;
  }
}

export async function publicPosts(): Promise<PublicPost[]> {
  if ((await dbPostCount()) === 0) return builtInPosts().map(fromFile);
  try {
    const rows = await db().post.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      include: { coverImage: true, author: { select: { name: true } } },
    });
    return rows.map((r) => ({
      slug: r.slug,
      lang: r.language,
      title: r.title,
      excerpt: r.excerpt,
      publishedAt: (r.publishedAt ?? r.createdAt).toISOString().slice(0, 10),
      author: r.authorName || r.author?.name || "Digitals Minds Team",
      tags: tagsOf(r.tags),
      body: r.body,
      cover: r.coverImage?.visibility === "PUBLIC" ? { url: mediaUrl(r.coverImage), alt: r.coverImage.altText ?? "", width: r.coverImage.width ?? undefined, height: r.coverImage.height ?? undefined } : null,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    return builtInPosts().map(fromFile);
  }
}

export async function publicPost(slug: string) {
  return (await publicPosts()).find((p) => p.slug === slug) ?? null;
}

// --- Admin -------------------------------------------------------------------------------

export const postInput = z.object({
  title: z.string().trim().min(3, "Enter a title").max(200),
  slug: z.string().trim().transform((v) => v.toLowerCase()).pipe(z.union([z.literal(""), slugSchema])),
  language: z.enum(["en", "ur"]),
  excerpt: z.string().trim().min(10, "Write a short summary (at least 10 characters)").max(500),
  body: z.string().trim().min(20, "Write the article").max(200_000),
  tags: z.string().max(300).transform((v) => [...new Set(v.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 8)),
  coverImageId: z.string().max(64).transform((v) => v || null),
  authorName: z.string().trim().max(120).transform((v) => v || null),
  seoTitle: z.string().trim().max(200).transform((v) => v || null),
  seoDescription: z.string().trim().max(320).transform((v) => v || null),
  published: z.boolean(),
  /** YYYY-MM-DD; empty = now when publishing. A future date schedules the post. */
  publishDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a valid date"),
});

export function listPostsAdmin() {
  return db().post.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], select: { id: true, title: true, slug: true, status: true, language: true, publishedAt: true, updatedAt: true } });
}

export function getPostForEdit(id: string) {
  return db().post.findUnique({ where: { id } });
}

export async function savePost(id: string | null, input: z.infer<typeof postInput>, actorId: string) {
  if (input.coverImageId) {
    const a = await db().mediaAsset.findUnique({ where: { id: input.coverImageId } });
    if (!a || a.visibility !== "PUBLIC" || !a.mimeType.startsWith("image/")) {
      throw new z.ZodError([{ code: "custom", path: ["coverImageId"], message: "Choose a public image from the Media library", input: input.coverImageId }]);
    }
  }
  const slug = input.slug || slugify(input.title) || `post-${Date.now().toString(36)}`;
  const clash = await db().post.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another post already uses this web address", input: slug }]);
  const existing = id ? await db().post.findUnique({ where: { id } }) : null;
  const publishedAt = input.published
    ? input.publishDate
      ? new Date(`${input.publishDate}T00:00:00+05:00`)
      : (existing?.publishedAt ?? new Date())
    : (existing?.publishedAt ?? null);
  const data = {
    title: input.title,
    slug,
    language: input.language,
    excerpt: input.excerpt,
    body: input.body,
    tags: input.tags,
    coverImageId: input.coverImageId,
    authorName: input.authorName,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    status: input.published ? ("PUBLISHED" as const) : ("DRAFT" as const),
    publishedAt,
  };
  const post = id ? await db().post.update({ where: { id }, data }) : await db().post.create({ data: { ...data, authorId: actorId } });
  await audit({ actorId, action: "content.post_saved", entityType: "Post", entityId: post.id, metadata: { title: post.title, status: post.status } });
  return post;
}

export async function deletePost(id: string, actorId: string) {
  const p = await db().post.delete({ where: { id } });
  await audit({ actorId, action: "content.post_deleted", entityType: "Post", entityId: id, metadata: { title: p.title } });
}

/** Copies the built-in posts into the database (once), so they can be edited. */
export async function importBuiltInPosts(actorId: string) {
  if ((await db().post.count()) > 0) return 0;
  const posts = builtInPosts();
  for (const p of posts) {
    await db().post.create({
      data: {
        slug: p.slug,
        language: p.lang,
        title: p.title,
        excerpt: p.excerpt,
        body: blocksToText(p.body),
        tags: p.tags,
        authorName: p.author,
        status: "PUBLISHED",
        publishedAt: new Date(`${p.publishedAt}T00:00:00+05:00`),
        authorId: actorId,
      },
    });
  }
  await audit({ actorId, action: "content.posts_imported", entityType: "Post", metadata: { count: posts.length } });
  return posts.length;
}

export const builtInPostCount = () => builtInPosts().length;
