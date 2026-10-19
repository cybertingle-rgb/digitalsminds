/**
 * Core Digitals Minds divisions. Each entry powers the Services overview,
 * its own /services/[slug] page, the homepage grid and the inquiry form's
 * service selector. Review copy against the official business materials.
 */

export type Service = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  offerings: string[];
  idealFor: string[];
};

export const services: Service[] = [
  {
    slug: "digital-marketing-growth",
    title: "Digital Marketing & Growth",
    shortTitle: "Marketing & Growth",
    summary: "Plan, launch and optimise campaigns that build visibility and bring in customers.",
    description:
      "We help businesses get found and chosen online, from strategy through execution, combining organic and paid channels with clear reporting so you always know what your marketing is doing.",
    offerings: [
      "Digital marketing strategy and planning",
      "Social media management and growth",
      "Paid advertising campaigns",
      "Search engine optimisation (SEO)",
      "Content and email marketing",
      "Analytics, tracking and performance reporting",
    ],
    idealFor: ["New brands building an audience", "Businesses ready to scale their online sales"],
  },
  {
    slug: "product-sourcing-logistics",
    title: "Product Sourcing & Logistics",
    shortTitle: "Sourcing & Logistics",
    summary: "Find reliable suppliers and move products from factory to customer.",
    description:
      "We support product-based businesses with supplier research, sampling and coordination of the logistics needed to get inventory where it needs to be.",
    offerings: [
      "Product research and supplier sourcing",
      "Sampling and quality checks coordination",
      "Order and shipment coordination",
      "Packaging and labelling guidance",
      "Fulfilment and logistics planning",
    ],
    idealFor: ["E-commerce sellers launching new products", "Brands moving to private label"],
  },
  {
    slug: "media-content-production",
    title: "Media & Content Production",
    shortTitle: "Media & Content",
    summary: "Photo, video and creative content that tells your brand's story.",
    description:
      "From product shoots to social-ready video, we produce the creative assets your brand needs to stand out across every channel.",
    offerings: [
      "Product and brand photography",
      "Video production and editing",
      "Short-form social content",
      "Graphic design and creatives",
      "Copywriting and scripting",
    ],
    idealFor: ["Brands refreshing their visual identity", "Teams that need a steady content pipeline"],
  },
  {
    slug: "startup-brand-setup",
    title: "Startup & Brand Setup",
    shortTitle: "Startup & Brand",
    summary: "Turn an idea into a ready-to-launch business with a clear brand.",
    description:
      "We guide founders through the foundations of a new business: positioning, brand identity and the practical setup needed to launch with confidence.",
    offerings: [
      "Business idea validation and planning",
      "Brand strategy, naming and positioning",
      "Visual identity and brand guidelines",
      "Business setup guidance",
      "Go-to-market planning",
    ],
    idealFor: ["First-time founders", "Existing businesses launching a new brand"],
  },
  {
    slug: "web-ecommerce",
    title: "Web & E-Commerce",
    shortTitle: "Web & E-Commerce",
    summary: "Fast, modern websites and online stores built to convert.",
    description:
      "We design and build websites and online stores that look professional, load quickly and make it easy for customers to buy or get in touch.",
    offerings: [
      "Business website design and development",
      "E-commerce store setup",
      "Marketplace and storefront setup",
      "Payment, shipping and integrations",
      "Maintenance, speed and security improvements",
    ],
    idealFor: ["Businesses without a strong online presence", "Sellers ready to own their sales channel"],
  },
];

export function getService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

export const serviceSlugs = services.map((s) => s.slug) as [string, ...string[]];
