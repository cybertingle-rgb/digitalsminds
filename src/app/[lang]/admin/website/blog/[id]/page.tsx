import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pkDay } from "@/lib/pk-time";
import { requirePagePermission } from "@/modules/auth/session";
import { getPostForEdit } from "@/modules/content/blog";
import { publicImages } from "@/modules/content/settings";
import { PostForm } from "../PostForm";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/[lang]/admin/website/blog/[id]">) {
  const { id } = await params;
  await requirePagePermission("content.manage", `/admin/website/blog/${id}`);
  const [post, images] = await Promise.all([getPostForEdit(id), publicImages()]);
  if (!post) notFound();
  const tags = Array.isArray(post.tags) ? (post.tags as unknown[]).filter((t): t is string => typeof t === "string").join(", ") : "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/website/blog" className="text-sm text-muted hover:text-charcoal-900">← All posts</Link>
        {post.status === "PUBLISHED" && <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">View on website</a>}
      </div>
      <section className="glass rounded-2xl p-6">
        <PostForm
          images={images}
          post={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            language: post.language,
            excerpt: post.excerpt,
            body: post.body,
            tags,
            coverImageId: post.coverImageId ?? "",
            authorName: post.authorName ?? "",
            seoTitle: post.seoTitle ?? "",
            seoDescription: post.seoDescription ?? "",
            published: post.status === "PUBLISHED",
            publishDate: post.publishedAt ? pkDay(post.publishedAt) : "",
          }}
        />
      </section>
    </div>
  );
}
