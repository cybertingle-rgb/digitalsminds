"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { deletePost, importBuiltInPosts, postInput, savePost } from "@/modules/content/blog";
import type { WebsiteState } from "../actions";

function failure(e: unknown): WebsiteState {
  if (e instanceof ForbiddenError) return { status: "error", message: e.message };
  if (e instanceof z.ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", errors };
  }
  console.error("[blog] action failed", e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

export async function savePostAction(id: string | null, _prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  try {
    const actor = await assertPermission("content.manage");
    const s = (k: string) => String(fd.get(k) ?? "");
    const input = postInput.parse({
      title: s("title"),
      slug: s("slug"),
      language: s("language"),
      excerpt: s("excerpt"),
      body: s("body"),
      tags: s("tags"),
      coverImageId: s("coverImageId"),
      authorName: s("authorName"),
      seoTitle: s("seoTitle"),
      seoDescription: s("seoDescription"),
      published: fd.get("published") === "on",
      publishDate: s("publishDate"),
    });
    const post = await savePost(id ? z.string().max(64).parse(id) : null, input, actor.id);
    revalidatePath("/[lang]", "layout");
    const scheduled = post.status === "PUBLISHED" && post.publishedAt && post.publishedAt > new Date();
    return {
      status: "success",
      message: post.status === "DRAFT" ? "Saved as a draft." : scheduled ? "Scheduled: it appears on the publish date." : "Saved and published.",
      ...(id ? {} : { redirectTo: `/admin/website/blog/${post.id}` }),
    };
  } catch (e) {
    return failure(e);
  }
}

export async function deletePostAction(id: string): Promise<WebsiteState> {
  try {
    const actor = await assertPermission("content.manage");
    await deletePost(z.string().max(64).parse(id), actor.id);
    revalidatePath("/[lang]", "layout");
    return { status: "success", message: "Deleted.", redirectTo: "/admin/website/blog" };
  } catch (e) {
    return failure(e);
  }
}

export async function importPostsAction(): Promise<WebsiteState> {
  try {
    const actor = await assertPermission("content.manage");
    const n = await importBuiltInPosts(actor.id);
    revalidatePath("/[lang]", "layout");
    return { status: "success", message: `${n} post${n === 1 ? "" : "s"} copied. You can now edit them.` };
  } catch (e) {
    return failure(e);
  }
}
