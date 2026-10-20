import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatDate, getPosts } from "@/content/blog";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/blog">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return pageMetadata(lang, "/blog", { title: dict.nav.blog, description: dict.blog.metaDescription });
}

export default async function BlogPage({ params }: PageProps<"/[lang]/blog">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const posts = getPosts();
  return (
    <Section>
      <SectionHeading as="h1" eyebrow={dict.blog.eyebrow} title={dict.blog.title} />
      {posts.length === 0 ? (
        <p className="mt-10 text-muted">{dict.blog.empty}</p>
      ) : (
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            // Posts are written in one language; mark it so it renders correctly on either locale.
            <li key={p.slug} lang={localeMeta[p.lang].htmlLang} dir={localeMeta[p.lang].dir}>
              <article className="glass flex h-full flex-col rounded-3xl !border-t-4 !border-t-sun-400 p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-gold-700">{p.tags.join(" · ")}</p>
                <h2 className="mt-2 text-lg font-semibold text-charcoal-900">
                  <Link href={localizePath(`/blog/${p.slug}`, lang)} className="hover:underline">
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-sm text-muted">{p.excerpt}</p>
                <time dateTime={p.publishedAt} className="mt-4 text-xs text-muted">
                  {formatDate(p.publishedAt, localeMeta[p.lang].intl)}
                </time>
              </article>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
