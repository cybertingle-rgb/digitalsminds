/**
 * Starting text for the professional services, copied into the database the
 * first time the services are read (Admin → Services edits them from then on).
 * The five original divisions take their text from the English dictionary.
 */
import { en } from "@/i18n/dictionaries/en";

export type ServiceSeed = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  offerings: string[];
  idealFor: string[];
  notice: string | null;
  /** ProgramCategory id created by the phase 21 migration. */
  categoryId: string | null;
  sortOrder: number;
};

const NO_CREDENTIALS = "We will never ask for your marketplace password, one-time codes or other login details, and you should not send them to anyone.";

const newServices: ServiceSeed[] = [
  {
    slug: "international-brand-launch",
    title: "International Brand Launch",
    shortTitle: "Brand Launch",
    summary: "Launch your own brand in a new country: validate the idea, choose the market, source and check the product, build the store and plan the first customers.",
    description:
      "A complete brand-launch package or individual services, for founders who want to sell their own product in Pakistan, the US, the UK, the Gulf or Europe. We work through each decision with you, from whether the idea is worth pursuing to the numbers, the suppliers, the packaging, the logistics and the launch plan.",
    offerings: [
      "Business idea validation",
      "Market research and competitor analysis",
      "Country and market selection",
      "Product selection and supplier discovery",
      "China-based and local supplier sourcing",
      "Supplier verification and negotiation",
      "Product samples and quality checks",
      "Manufacturing and production coordination",
      "Packaging and brand identity",
      "Landed-cost and profitability calculations",
      "Logistics and fulfilment planning",
      "Shopify, WooCommerce or custom online store",
      "Marketplace launch preparation",
      "Digital marketing and customer acquisition plan",
    ],
    idealFor: [
      "Founders launching their first product brand",
      "Sellers moving from reselling to their own brand",
      "Businesses entering a new country or marketplace",
      "Anyone who needs one part done well, e.g. sourcing or landed-cost numbers",
    ],
    notice: "Results depend on your product, market, budget and execution. We do not guarantee sales, supplier performance, delivery times or marketplace approval.",
    categoryId: "cat_brand_launch",
    sortOrder: 10,
  },
  {
    slug: "llc-marketplace-readiness",
    title: "LLC Formation & Marketplace Readiness",
    shortTitle: "LLC & Readiness",
    summary: "Guidance and paperwork support for forming an LLC, preparing documents and getting ready to apply for seller accounts and payment providers.",
    description:
      "Selling internationally often starts with the right business setup. We explain the options, help you prepare and organise the documents, and get your details consistent before you apply to marketplaces and payment providers, so that you understand what each application asks for. Where legal, tax or accounting advice is needed, it comes from appropriately qualified professionals.",
    offerings: [
      "LLC formation assistance",
      "Business registration guidance",
      "Documentation preparation and checklists",
      "Seller account onboarding and verification readiness",
      "Payment-provider eligibility guidance",
      "Marketplace application preparation",
      "Tax and compliance guidance through qualified professionals where needed",
    ],
    idealFor: [
      "Sellers planning to sell on US or international marketplaces",
      "Freelancers and agencies setting up a business abroad",
      "Anyone unsure which documents an application needs",
    ],
    notice:
      "Educational guidance and administrative support only. Legal, tax and accounting advice is provided only by appropriately qualified professionals. Company registration, banking, payment-provider and marketplace approval are decided by the relevant authorities and companies; we cannot guarantee any approval.",
    categoryId: "cat_llc_readiness",
    sortOrder: 20,
  },
  {
    slug: "account-reinstatement",
    title: "Suspended Account Reinstatement Support",
    shortTitle: "Account Reinstatement",
    summary: "Help with suspended or restricted marketplace accounts: case assessment, policy review, root-cause analysis, a corrective-action plan and a well-prepared appeal.",
    description:
      "A suspension needs a clear, honest response that addresses the actual cause. We review what happened against the marketplace's policies and your account health, identify the root cause, prepare a documentation checklist and a corrective-action plan, and review your appeal before you submit it. We then help you follow up and keep track of the case.",
    offerings: [
      "Initial case assessment",
      "Account health and policy review",
      "Root-cause analysis",
      "Documentation checklist",
      "Corrective-action plan",
      "Appeal preparation and review",
      "Follow-up and case-status tracking",
    ],
    idealFor: [
      "Sellers with a suspended, deactivated or restricted account on a supported marketplace",
      "Sellers whose earlier appeal was declined",
      "Businesses that want to fix account-health issues before they lead to suspension",
    ],
    notice: `Reinstatement decisions belong to the marketplace and cannot be guaranteed. ${NO_CREDENTIALS}`,
    categoryId: "cat_reinstatement",
    sortOrder: 30,
  },
  {
    slug: "ai-automation",
    title: "AI & Business Automation",
    shortTitle: "AI & Automation",
    summary: "Practical AI and automation for small businesses and sellers: faster content, smarter support, organised leads and fewer repetitive tasks.",
    description:
      "We find the repetitive work in your business and set up AI tools and automations that save real time, with people still in control of what goes out. From AI-assisted content to support assistants, lead and CRM workflows and e-commerce process automation, built with the no-code and low-code tools that suit your team.",
    offerings: [
      "AI productivity workflows",
      "AI-assisted content creation",
      "No-code and low-code automation",
      "AI agents and business assistants",
      "Customer support automation",
      "Lead management and CRM workflows",
      "E-commerce process automation",
      "AI integrations for practical business use cases",
    ],
    idealFor: [
      "Small teams spending hours on repetitive tasks",
      "Online sellers handling many messages and orders",
      "Businesses that want to use AI safely and practically",
    ],
    notice: null,
    categoryId: "cat_ai",
    sortOrder: 40,
  },
];

const original: { slug: keyof typeof en.services; categoryId: string; sortOrder: number }[] = [
  { slug: "digital-marketing-growth", categoryId: "cat_marketing", sortOrder: 50 },
  { slug: "web-ecommerce", categoryId: "cat_brand_launch", sortOrder: 60 },
  { slug: "product-sourcing-logistics", categoryId: "cat_brand_launch", sortOrder: 70 },
  { slug: "startup-brand-setup", categoryId: "cat_brand_launch", sortOrder: 80 },
  { slug: "media-content-production", categoryId: "cat_marketing", sortOrder: 90 },
];

export const serviceSeeds: ServiceSeed[] = [
  ...newServices,
  ...original.map(({ slug, categoryId, sortOrder }) => {
    const s = en.services[slug];
    return { slug, title: s.title, shortTitle: s.shortTitle, summary: s.summary, description: s.description, offerings: [...s.offerings], idealFor: [...s.idealFor], notice: null, categoryId, sortOrder };
  }),
];

/** Labels for inquiry topics that are not services. */
export const extraInquiryTopics: Record<string, string> = {
  general: "General inquiry",
  training: "Training programs and enrollment",
  "ebay-course": "eBay course enrollment",
};
