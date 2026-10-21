"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import type { WebsiteState } from "../actions";
import { ImagePicker, type ImageOption } from "../WebsiteForms";
import { deletePostAction, importPostsAction, savePostAction } from "./actions";

const idle: WebsiteState = { status: "idle" };

export type PostValues = {
  id?: string; title: string; slug: string; language: "en" | "ur"; excerpt: string; body: string; tags: string;
  coverImageId: string; authorName: string; seoTitle: string; seoDescription: string; published: boolean; publishDate: string;
};

export function PostForm({ post, images }: { post: PostValues; images: ImageOption[] }) {
  const [state, onSubmit, pending] = useFormAction(savePostAction.bind(null, post.id ?? null), idle);
  const router = useRouter();
  const [body, setBody] = useState(post.body);
  const [insert, setInsert] = useState("");
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
  const e = (k: string) => state.errors?.[k];
  const a = (k: string, hint?: string) => ({ id: k, name: k, "aria-invalid": e(k) ? true : undefined, "aria-describedby": describedBy(k, e(k), hint) });
  const ur = post.language === "ur";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Title" name="title" error={e("title")}>
            <input {...a("title")} defaultValue={post.title} maxLength={200} dir="auto" className={inputClass} />
          </Field>
        </div>
        {/* Urdu interface removed: posts are English; an older post keeps its saved value. */}
        <input type="hidden" name="language" value={post.language} />
      </div>
      <Field label="Summary" name="excerpt" error={e("excerpt")} hint="Shown on the blog page and in search results.">
        <textarea {...a("excerpt", "hint")} rows={2} defaultValue={post.excerpt} maxLength={500} dir="auto" className={inputClass} />
      </Field>
      <div className="glass-subtle space-y-3 rounded-2xl p-4">
        <Field label="Article" name="body" error={e("body")} hint="Blank line = new paragraph · “## ” = heading · “- ” = bullet · links are clickable.">
          <textarea {...a("body", "hint")} rows={18} value={body} onChange={(ev) => setBody(ev.target.value)} maxLength={200000} dir={ur ? "rtl" : "auto"} lang={ur ? "ur" : undefined} className={inputClass} />
        </Field>
        {images.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="insertImage" className="block text-sm font-medium text-charcoal-900">Add an image to the article</label>
              <select id="insertImage" value={insert} onChange={(ev) => setInsert(ev.target.value)} className={inputClass}>
                <option value="">Choose a public image…</option>
                {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="py-2.5"
              disabled={!insert}
              onClick={() => {
                const img = images.find((i) => i.id === insert);
                if (img) setBody((b) => `${b.trimEnd()}\n\n![${img.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "")}](${img.url})\n`);
                setInsert("");
              }}
            >
              Insert at the end
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePicker name="coverImageId" label="Cover image (optional)" images={images} value={post.coverImageId} error={e("coverImageId")} />
        <div className="space-y-4">
          <Field label="Tags (comma separated)" name="tags">
            <input {...a("tags")} defaultValue={post.tags} maxLength={300} placeholder="Marketing, E-commerce" className={inputClass} />
          </Field>
          <Field label="Author name shown" name="authorName">
            <input {...a("authorName")} defaultValue={post.authorName} maxLength={120} placeholder="Digitals Minds Team" className={inputClass} />
          </Field>
        </div>
      </div>
      <details className="glass-subtle rounded-2xl p-4">
        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Web address and search settings</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Web address" name="slug" error={e("slug")} hint="Leave empty to create it from the title.">
            <input {...a("slug", "hint")} defaultValue={post.slug} maxLength={80} dir="ltr" className={inputClass} />
          </Field>
          <Field label="Search title" name="seoTitle">
            <input {...a("seoTitle")} defaultValue={post.seoTitle} maxLength={200} dir="auto" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Search description" name="seoDescription">
              <textarea {...a("seoDescription")} rows={2} defaultValue={post.seoDescription} maxLength={320} dir="auto" className={inputClass} />
            </Field>
          </div>
        </div>
      </details>
      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-3 text-sm text-charcoal-900">
          <input type="checkbox" name="published" defaultChecked={post.published} className="h-5 w-5 accent-charcoal-900" />
          Published
        </label>
        <Field label="Publish date (optional)" name="publishDate" error={e("publishDate")} hint="A future date schedules the post.">
          <input {...a("publishDate", "hint")} type="date" defaultValue={post.publishDate} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save post"}</Button>
        {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
      </div>
      {post.id && <DeletePost id={post.id} />}
    </form>
  );
}

function DeletePost({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => setConfirm(true)}>Delete this post</button>;
  return (
    <div role="alertdialog" aria-label="Delete post" className="flex flex-wrap items-center gap-3 rounded-xl border border-sun-400 bg-sun-50 p-4 text-sm">
      Delete this post permanently?
      <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => start(async () => { const r = await deletePostAction(id); if (r.redirectTo) router.push(r.redirectTo); })}>Delete</Button>
      <Button type="button" variant="secondary" className="py-2" onClick={() => setConfirm(false)}>Cancel</Button>
    </div>
  );
}

export function ImportPosts({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<WebsiteState | null>(null);
  return (
    <div className="glass-sun space-y-3 rounded-2xl p-5">
      <p className="text-sm">The blog currently shows {count} built-in post{count === 1 ? "" : "s"}. Copy {count === 1 ? "it" : "them"} here to edit, or write a new post (the built-in {count === 1 ? "post" : "posts"} then stop showing).</p>
      <Button type="button" variant="dark" className="py-2" disabled={pending} onClick={() => start(async () => setResult(await importPostsAction()))}>
        Copy the current posts here
      </Button>
      {result && <Notice tone={result.status === "error" ? "error" : "success"}>{result.message}</Notice>}
    </div>
  );
}
