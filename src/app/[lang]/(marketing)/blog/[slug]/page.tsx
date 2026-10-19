import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Arrow } from "@/components/ui/Arrow";
import { Container } from "@/components/ui/Container";
import { formatDate, getPost, getPosts, type Block } from "@/content/blog";
import { hasLocale, localeMeta, locales, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";

type Props = PageProps<"/[lang]/blog/[slug]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => getPosts().map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = getPost(slug);
  if (!post || !hasLocale(lang)) return {};
  const base = pageMetadata(lang, `/blog/${slug}`, { title: post.title, description: post.excerpt });
  return { ...base, openGraph: { ...base.openGraph, type: "article", publishedTime: post.publishedAt } };
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={i} className="mt-10 text-2xl font-bold text-charcoal-900">
          {block.text}
        </h2>
      );
    case "ul":
      return (
        <ul key={i} className="mt-4 list-disc space-y-1 ps-6 marker:text-sun-500">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    default:
      return (
        <p key={i} className="mt-4 leading-relaxed">
          {block.text}
        </p>
      );
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const post = getPost(slug);
  if (!post) notFound();
  const dict = getDictionary(lang);
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
            <div className="mt-8 text-lg text-charcoal-800">{post.body.map(renderBlock)}</div>
          </div>
        </Container>
      </article>
      <CtaBanner title={dict.cta.title} text={dict.cta.text} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
