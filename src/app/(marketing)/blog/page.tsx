import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatDate, getPosts } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and updates on marketing, sourcing, branding, media and e-commerce from Digitals Minds.",
};

export default function BlogPage() {
  const posts = getPosts();
  return (
    <Section>
      <SectionHeading as="h1" eyebrow="Blog" title="Insights to help you learn, grow and earn" />
      {posts.length === 0 ? (
        <p className="mt-10 text-muted">New articles are on the way. Check back soon.</p>
      ) : (
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.slug}>
              <article className="flex h-full flex-col rounded-2xl border border-line p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{p.tags.join(" · ")}</p>
                <h2 className="mt-2 text-lg font-semibold">
                  <Link href={`/blog/${p.slug}`} className="hover:text-brand-700">
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-sm text-muted">{p.excerpt}</p>
                <time dateTime={p.publishedAt} className="mt-4 text-xs text-muted">
                  {formatDate(p.publishedAt)}
                </time>
              </article>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
