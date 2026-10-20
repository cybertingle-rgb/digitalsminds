/**
 * Website content management against a real database. Run with `npm run test:db`.
 * Note: these tests touch the shared SiteSetting rows and content tables, so
 * they snapshot and restore them.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("content management (integration)", async () => {
  const { db } = await import("@/lib/db");
  const settings = await import("@/modules/content/settings");
  const items = await import("@/modules/content/items");
  const blog = await import("@/modules/content/blog");
  const { getDictionary } = await import("@/i18n/get-dictionary");
  const dict = getDictionary("en");
  const tag = randomUUID().slice(0, 8);
  const actor = `t${tag}_cm`;
  const keys = ["site.home", "site.contact", "site.seo", "page.privacy"];
  let saved: { key: string; value: unknown }[] = [];
  let hadFaqs = 0;
  let hadPosts = 0;

  beforeAll(async () => {
    await db().user.create({ data: { id: actor, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" } });
    saved = (await db().siteSetting.findMany({ where: { key: { in: keys } } })).map((r) => ({ key: r.key, value: r.value }));
    await db().siteSetting.deleteMany({ where: { key: { in: keys } } });
    hadFaqs = await db().faq.count();
    hadPosts = await db().post.count();
  });

  afterAll(async () => {
    await db().siteSetting.deleteMany({ where: { key: { in: keys } } });
    for (const s of saved) await db().siteSetting.create({ data: { key: s.key, value: s.value as object } });
    await db().faq.deleteMany({ where: { question: { contains: tag } } });
    if (hadFaqs === 0) await db().faq.deleteMany({});
    await db().post.deleteMany({ where: { authorId: actor } });
    await db().testimonial.deleteMany({ where: { name: { contains: tag } } });
    await db().caseStudy.deleteMany({ where: { slug: { contains: tag } } });
    await db().auditLog.deleteMany({ where: { actorId: actor } });
    await db().user.deleteMany({ where: { id: actor } });
    await db().$disconnect();
  });

  it("falls back to built-in text and uses edited text (with Urdu falling back to English)", async () => {
    expect((await settings.homeText("en", dict)).heroTitle).toBe(dict.brand.positioning);
    await settings.saveSetting("site.home", settings.homeInput.parse({ heroTitle: "Grow with us", heroText: "", why: [{ title: "Fast" }] }), actor);
    const en = await settings.homeText("en", dict);
    expect(en.heroTitle).toBe("Grow with us");
    expect(en.heroText).toBe(dict.home.heroText);
    expect(en.why[0]!.title).toBe("Fast");
    expect(en.why[1]!.title).toBe(dict.home.why[1]!.title);
    expect((await settings.homeText("ur", getDictionary("ur"))).heroTitle).toBe("Grow with us");
  });

  it("validates contact details and SEO overrides", async () => {
    expect(() => settings.contactInput.parse({ email: "nope", address: [], addressUr: [] })).toThrow();
    await settings.saveSetting("site.contact", settings.contactInput.parse({ email: "hello@digitalsminds.com", address: ["Line 1", "Line 2"], addressUr: [] }), actor);
    expect(await settings.contactDetails("ur", dict)).toEqual({ email: "hello@digitalsminds.com", address: ["Line 1", "Line 2"] });
    await settings.saveSetting("site.seo", settings.seoInput.parse({ about: { title: "About Digitals Minds", titleUr: "", description: "", descriptionUr: "", imageId: "" } }), actor);
    expect(await settings.seoFor("about", "en")).toMatchObject({ title: "About Digitals Minds" });
    expect(await settings.seoFor("home", "en")).toEqual({});
  });

  it("publishes the built-in legal text until an edited version is saved", async () => {
    expect(await settings.getLegalPage("privacy")).toMatchObject({ title: "Privacy Policy", published: true, builtIn: true });
    await settings.saveSetting("page.privacy", { ...settings.legalInput.parse({ title: "Privacy Policy", body: "We respect your privacy and explain here.", published: false }) }, actor);
    expect(await settings.getLegalPage("privacy")).toMatchObject({ published: false, builtIn: false });
  });

  it("imports built-in FAQs once, then serves only published ones in order", async () => {
    if (hadFaqs > 0) return; // shared database already has FAQs; covered on a clean database
    expect(await items.publicFaqs("en", dict)).toEqual(dict.home.faq);
    await items.importDefaultFaqs(dict, actor);
    await expect(items.importDefaultFaqs(dict, actor)).rejects.toThrow(/already/);
    const all = await items.listFaqs();
    expect(all).toHaveLength(dict.home.faq.length);
    await items.updateFaq(all[0]!.id, { question: `Q ${tag}`, questionUr: null, answer: "Answer text", answerUr: "اردو جواب", published: false }, actor);
    await items.moveItem("faq", all[2]!.id, "up");
    const pub = await items.publicFaqs("ur", dict);
    expect(pub.map((f) => f.q)).not.toContain(`Q ${tag}`);
    expect(pub[0]!.q).toBe(dict.home.faq[2]!.q);
  });

  it("requires consent before publishing testimonials and case studies", () => {
    const base = { name: `Ayesha ${tag}`, roleTitle: "", company: "", quote: "Great team to work with.", quoteUr: "", photoId: "", featured: false };
    expect(() => items.testimonialInput.parse({ ...base, consentConfirmed: false, published: true })).toThrow(/permission/);
    expect(items.testimonialInput.parse({ ...base, consentConfirmed: true, published: true }).published).toBe(true);
    const cs = { title: "Store launch", titleUr: "", slug: "", client: "", summary: "A new online store.", summaryUr: "", body: "We built a store in four weeks.", bodyUr: "", serviceSlug: "web-ecommerce", coverImageId: "" };
    expect(() => items.caseStudyInput.parse({ ...cs, consentConfirmed: false, published: true })).toThrow(/agreed/);
  });

  it("serves only published, consented case studies and keeps slugs unique", async () => {
    const input = items.caseStudyInput.parse({ title: `Store ${tag}`, titleUr: "", slug: `store-${tag}`, client: "Ayesha Crafts", summary: "A new online store.", summaryUr: "", body: "We built a store in four weeks.", bodyUr: "", serviceSlug: "web-ecommerce", coverImageId: "", consentConfirmed: true, published: false });
    const c = await items.saveCaseStudy(null, input, actor);
    expect(await items.caseStudyBySlug(`store-${tag}`)).toBeNull();
    await items.saveCaseStudy(c.id, { ...input, published: true }, actor);
    expect((await items.caseStudyBySlug(`store-${tag}`))?.client).toBe("Ayesha Crafts");
    await expect(items.saveCaseStudy(null, { ...input, title: "Other" }, actor)).rejects.toThrow(/already uses/);
  });

  it("moves the blog to the database without losing the built-in post", async () => {
    if (hadPosts > 0) return;
    const before = await blog.publicPosts();
    expect(before.map((p) => p.slug)).toContain("welcome-to-digitals-minds");
    expect(before[0]!.body).toContain("## Five divisions, one team");
    const n = await blog.importBuiltInPosts(actor);
    expect(n).toBeGreaterThan(0);
    expect(await blog.importBuiltInPosts(actor)).toBe(0);
    const after = await blog.publicPosts();
    expect(after.map((p) => p.slug)).toEqual(before.map((p) => p.slug));
    const base = { title: `Draft ${tag}`, slug: "", language: "en", excerpt: "A short summary here.", body: "Body text for the article.", tags: "Tips, Tips, Growth", coverImageId: "", authorName: "", seoTitle: "", seoDescription: "", publishDate: "" };
    const draft = await blog.savePost(null, blog.postInput.parse({ ...base, published: false }), actor);
    expect(draft.tags).toEqual(["Tips", "Growth"]);
    expect((await blog.publicPosts()).some((p) => p.title === `Draft ${tag}`)).toBe(false);
    await blog.savePost(draft.id, blog.postInput.parse({ ...base, published: true, publishDate: "2099-01-01" }), actor);
    expect((await blog.publicPosts()).some((p) => p.title === `Draft ${tag}`)).toBe(false); // scheduled
    await blog.savePost(draft.id, blog.postInput.parse({ ...base, published: true, publishDate: "2026-01-01" }), actor);
    expect((await blog.publicPosts()).some((p) => p.title === `Draft ${tag}`)).toBe(true);
    await expect(blog.savePost(null, blog.postInput.parse({ ...base, slug: draft.slug, published: false }), actor)).rejects.toThrow(/already uses/);
  });
});
