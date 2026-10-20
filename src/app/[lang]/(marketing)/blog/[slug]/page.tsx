import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Arrow } from "@/components/ui/Arrow";
import { Container } from "@/components/ui/Container";
import { formatDate } from "@/content/blog";
import { publicPost } from "@/modules/content/blog";
import { RichText } from "@/modules/courses/richtext";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { homeText } from "@/modules/content/settings";
import { pageMetadata } from "@/i18n/metadata";

type Props = PageProps<"/[lang]/blog/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const post = await publicPost(slug);
  if (!post) return { robots: { index: false, follow: false } };
  const base = pageMetadata(lang, `/blog/${slug}`, {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    image: post.cover ? { url: post.cover.url, width: post.cover.width, height: post.cover.height } : undefined,
  });
  return { ...base, openGraph: { ...base.openGraph, type: "article", publishedTime: post.publishedAt } };
}

export default async function BlogPostPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const post = await publicPost(slug);
  if (!post) notFound();
  const dict = getDictionary(lang);
  const h = await homeText(lang, dict);
  const postMeta = localeMeta[post.lang];

  return (
    <>
      <article className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <Link href={localizePath("/blog", lang)} className="text-sm text-muted hover:text-charcoal-900">
            <Arrow back /> {dict.blog.allArticles}
          </Link>
          <div lang={postMeta.htmlLang} dir={postMeta.dir}>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-4xl">{post.title}</h1>
            <p className="mt-4 text-sm text-muted">
              {post.author} · <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, postMeta.intl)}</time>
            </p>
            {post.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover.url} alt={post.cover.alt} className="mt-8 w-full rounded-3xl ring-1 ring-white" />
            )}
            <div className="glass-strong mt-8 rounded-3xl p-6 sm:p-10">
              <RichText text={post.body} className="text-lg text-charcoal-800" />
            </div>
          </div>
        </Container>
      </article>
      <CtaBanner title={h.ctaTitle} text={h.ctaText} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
