import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/modules/auth/session";
import { publicImages } from "@/modules/content/settings";
import { PostForm } from "../PostForm";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requirePagePermission("content.manage", "/admin/website/blog/new");
  const images = await publicImages();
  return (
    <div className="space-y-4">
      <Link href="/admin/website/blog" className="text-sm text-muted hover:text-charcoal-900">← All posts</Link>
      <section className="glass rounded-2xl p-6">
        <PostForm images={images} post={{ title: "", slug: "", language: "en", excerpt: "", body: "", tags: "", coverImageId: "", authorName: "", seoTitle: "", seoDescription: "", published: false, publishDate: "" }} />
      </section>
    </div>
  );
}
