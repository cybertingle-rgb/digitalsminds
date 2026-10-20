import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/Button";
import { requirePagePermission } from "@/modules/auth/session";
import { builtInPostCount, listPostsAdmin } from "@/modules/content/blog";
import { ImportPosts } from "./PostForm";

export const metadata: Metadata = { title: "Blog" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function BlogAdminPage() {
  await requirePagePermission("content.manage", "/admin/website/blog");
  const posts = await listPostsAdmin();
  const now = new Date();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Articles on /blog. Each post is written in one language.</p>
        <LinkButton href="/admin/website/blog/new" variant="dark" className="py-2">New post</LinkButton>
      </div>
      {posts.length === 0 && builtInPostCount() > 0 && <ImportPosts count={builtInPostCount()} />}
      {posts.length > 0 && (
        <ul className="space-y-3">
          {posts.map((p) => {
            const scheduled = p.status === "PUBLISHED" && p.publishedAt && p.publishedAt > now;
            return (
              <li key={p.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
                <div className="min-w-0">
                  <Link href={`/admin/website/blog/${p.id}`} className="font-semibold text-charcoal-900 hover:underline" dir="auto">{p.title}</Link>
                  <p className="text-xs text-muted">
                    /blog/{p.slug} · {p.language === "ur" ? "Urdu" : "English"} · {p.publishedAt ? dateFmt.format(p.publishedAt) : `edited ${dateFmt.format(p.updatedAt)}`}
                  </p>
                </div>
                <StatusBadge tone={p.status === "DRAFT" ? "off" : scheduled ? "warn" : "ok"}>{p.status === "DRAFT" ? "Draft" : scheduled ? "Scheduled" : "Published"}</StatusBadge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
