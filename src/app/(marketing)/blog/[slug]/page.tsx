import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Container } from "@/components/ui/Container";
import { formatDate, getPost, getPosts, type Block } from "@/content/blog";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt },
  };
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case "h2":
      return <h2 key={i} className="mt-10 text-2xl font-bold">{block.text}</h2>;
    case "ul":
      return (
        <ul key={i} className="mt-4 list-disc space-y-1 pl-6">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      );
    default:
      return <p key={i} className="mt-4 leading-relaxed">{block.text}</p>;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <>
      <article className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <Link href="/blog" className="text-sm text-muted hover:text-ink">← All articles</Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-sm text-muted">
            {post.author} · <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          </p>
          <div className="mt-8 text-lg text-ink/90">{post.body.map(renderBlock)}</div>
        </Container>
      </article>
      <CtaBanner />
    </>
  );
}
