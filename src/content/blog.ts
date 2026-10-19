/**
 * Blog content. Posts live in code for now; `getPosts`/`getPost` are the only
 * access points so the source can later move to the database or a CMS
 * without touching the pages.
 */

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type Post = {
  slug: string;
  /** Language the post is written in; posts are not translated. */
  lang: "en" | "ur";
  title: string;
  excerpt: string;
  /** ISO date (YYYY-MM-DD) */
  publishedAt: string;
  author: string;
  tags: string[];
  body: Block[];
};

const posts: Post[] = [
  {
    slug: "welcome-to-digitals-minds",
    lang: "en",
    title: "Welcome to Digitals Minds: Learn | Grow | Earn",
    excerpt: "An introduction to Digitals Minds and the five divisions behind our business growth and brand development initiative.",
    publishedAt: "2026-10-19",
    author: "Digitals Minds Team",
    tags: ["Announcements"],
    body: [
      {
        type: "p",
        text: "Digitals Minds is a complete business growth and brand development initiative. Our philosophy is simple: Learn, Grow, Earn. We help founders and businesses build the knowledge, brand and systems they need to grow.",
      },
      { type: "h2", text: "Five divisions, one team" },
      {
        type: "ul",
        items: [
          "Digital Marketing & Growth",
          "Product Sourcing & Logistics",
          "Media & Content Production",
          "Startup & Brand Setup",
          "Web & E-Commerce",
        ],
      },
      {
        type: "p",
        text: "Because these services work together under one roof, your strategy, brand, content and sales channels stay aligned from day one.",
      },
      { type: "h2", text: "What's next" },
      {
        type: "p",
        text: "We'll use this blog to share practical guides on marketing, sourcing, branding and e-commerce. Have a question you'd like us to cover? Send us an inquiry.",
      },
    ],
  },
];

export function getPosts(): Post[] {
  return [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string, intlLocale = "en-US") {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(intlLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
