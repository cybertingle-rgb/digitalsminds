/**
 * Exchange rates, price snapshots, legacy price review and the catalogue,
 * against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const KEYS = ["currency.settings", "currency.status", "catalog.servicesSeeded"];

run("currency and catalogue (integration)", async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-currency-integration-0123456789");
  const { db } = await import("@/lib/db");
  const cur = await import("@/modules/currency/service");
  const catalog = await import("@/modules/catalog/service");
  const tag = randomUUID().slice(0, 8);
  const sa = { id: `t${tag}_sa`, role: "SUPER_ADMIN" as const };
  const cm = { id: `t${tag}_cm`, role: "CONTENT_MANAGER" as const };
  let saved: { key: string; value: unknown }[] = [];
  let savedRates: Awaited<ReturnType<typeof cur.storedRates>> = [];
  let savedServices: { slug: string }[] = [];
  const nowUnix = () => Math.floor(Date.now() / 1000);

  const okFetch = (rates: Record<string, number>, updated = nowUnix()) =>
    vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toMatch(/^https:\/\/(open\.er-api\.com\/v6\/latest\/PKR|v6\.exchangerate-api\.com\/v6\/.+\/latest\/PKR)$/);
      return new Response(JSON.stringify({ result: "success", base_code: "PKR", time_last_update_unix: updated, rates: { PKR: 1, ...rates } }), { status: 200 });
    }) as unknown as typeof fetch;

  beforeAll(async () => {
    saved = (await db().siteSetting.findMany({ where: { key: { in: KEYS } } })).map((r) => ({ key: r.key, value: r.value }));
    savedRates = await cur.storedRates();
    savedServices = await db().service.findMany({ select: { slug: true } });
    await db().siteSetting.deleteMany({ where: { key: { in: KEYS } } });
    await db().currencyRate.deleteMany({});
    await db().user.createMany({
      data: [
        { id: sa.id, name: "Owner", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
      ],
    });
  });

  afterAll(async () => {
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().service.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    if (savedServices.length === 0) await db().service.deleteMany({});
    await db().programCategory.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().siteSetting.deleteMany({ where: { key: { in: KEYS } } });
    for (const s of saved) await db().siteSetting.create({ data: { key: s.key, value: s.value as object } });
    await db().currencyRate.deleteMany({});
    if (savedRates.length) await db().currencyRate.createMany({ data: savedRates });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    vi.unstubAllEnvs();
    await db().$disconnect();
  });

  it("shows nothing but PKR before any rate is fetched", async () => {
    expect(await cur.getDisplayRates()).toMatchObject({ provider: "er-api", rates: {}, enabled: [] });
    expect(await cur.priceSnapshot(1_500_000, "USD")).toBeNull();
  });

  it("fetches rates, stores them with the provider's time, and offers only enabled currencies", async () => {
    const f = okFetch({ USD: 0.0035714, GBP: 0.0028, EUR: 0.0033, JPY: 0.54, XYZ: 9 });
    expect(await cur.refreshRates(f)).toEqual({ ok: true, count: 4 });
    const rows = await cur.storedRates();
    expect(rows.map((r) => r.currency)).toEqual(["EUR", "GBP", "JPY", "USD"]);
    const display = await cur.getDisplayRates();
    // JPY is supported but not enabled by default.
    expect(Object.keys(display.rates).sort()).toEqual(["EUR", "GBP", "USD"]);
    expect(display.rates.USD!.perPkr).toBeCloseTo(0.0035714, 9);
    expect((await cur.getRefreshStatus()).lastError).toBeNull();
  });

  it("keeps the last good rates when the provider fails, and records the error", async () => {
    const down = vi.fn(async () => new Response("oops", { status: 503 })) as unknown as typeof fetch;
    expect(await cur.refreshRates(down)).toEqual({ ok: false, error: "The rate provider answered with HTTP 503." });
    const bad = vi.fn(async () => new Response(JSON.stringify({ result: "error", "error-type": "quota-reached" }))) as unknown as typeof fetch;
    expect(await cur.refreshRates(bad)).toMatchObject({ ok: false, error: expect.stringMatching(/expected format/) });
    const slow = vi.fn(async () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    expect(await cur.refreshRates(slow)).toMatchObject({ ok: false, error: expect.stringMatching(/10 seconds/) });
    const status = await cur.getRefreshStatus();
    expect(status.lastError).toMatch(/10 seconds/);
    expect(status.lastSuccessAt).toBeTruthy();
    expect(Object.keys((await cur.getDisplayRates()).rates)).toHaveLength(3);
  });

  it("never shows a rate older than the maximum age", async () => {
    await cur.refreshRates(okFetch({ USD: 0.0036 }, nowUnix() - 80 * 3600));
    const display = await cur.getDisplayRates();
    expect(display.rates.USD).toBeUndefined();
    expect(await cur.priceSnapshot(1_500_000, "USD")).toBeNull();
    // A fresh fetch brings it back.
    await cur.refreshRates(okFetch({ USD: 0.0035714, GBP: 0.0028 }));
    expect((await cur.getDisplayRates()).rates.USD).toBeDefined();
  });

  it("snapshots what an applicant was shown, from the server's own rate", async () => {
    const snap = await cur.priceSnapshot(1_500_000, "USD");
    expect(snap).toMatchObject({ displayCurrency: "USD", displayAmount: 5357, displayProvider: "er-api" });
    expect(Number(snap!.displayRate)).toBeCloseTo(0.0035714, 9);
    expect(await cur.priceSnapshot(1_500_000, "PKR")).toBeNull();
    expect(await cur.priceSnapshot(1_500_000, "JPY")).toBeNull(); // not enabled
    expect(await cur.priceSnapshot(1_500_000, "<script>")).toBeNull();
  });

  it("only Super Admins change settings; manual rates and API keys work", async () => {
    const base = { provider: "manual" as const, enabled: ["USD", "AED"], maxAgeHours: 72, refreshHours: 12, manual: { USD: "280", AED: "76.25" } };
    await expect(cur.saveCurrencySettings(cur.settingsInput.parse(base), cm)).rejects.toThrow(/Super Admins/);
    await expect(cur.saveCurrencySettings(cur.settingsInput.parse({ ...base, manual: { USD: "-3" } }), sa)).rejects.toThrow(/USD/);
    await cur.saveCurrencySettings(cur.settingsInput.parse(base), sa);
    expect(await cur.refreshRates()).toEqual({ ok: true, count: 2 });
    const display = await cur.getDisplayRates();
    expect(display.provider).toBe("manual");
    expect(display.rates.USD!.perPkr).toBeCloseTo(1 / 280, 12);
    // Rates from the previous provider are not mixed in.
    expect(display.rates.GBP).toBeUndefined();

    await expect(cur.saveCurrencySettings(cur.settingsInput.parse({ ...base, provider: "exchangerate-api", manual: {} }), sa)).rejects.toThrow(/key/);
    await cur.saveCurrencySettings(cur.settingsInput.parse({ ...base, provider: "exchangerate-api", apiKey: "abc123", manual: {} }), sa);
    const stored = await cur.getCurrencySettings();
    expect(JSON.stringify(await db().siteSetting.findUnique({ where: { key: "currency.settings" } }))).not.toContain("abc123");
    const f = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://v6.exchangerate-api.com/v6/abc123/latest/PKR");
      return new Response(JSON.stringify({ result: "success", base_code: "PKR", time_last_update_unix: nowUnix(), conversion_rates: { USD: 0.0036 } }));
    }) as unknown as typeof fetch;
    expect(stored.apiKeyEnc).toBeTruthy();
    expect(await cur.refreshRates(f)).toEqual({ ok: true, count: 1 });
    // Back to the default provider for the remaining tests.
    await cur.saveCurrencySettings(cur.settingsInput.parse({ ...base, provider: "er-api", manual: {} }), sa);
    await cur.refreshRates(okFetch({ USD: 0.0035714 }));
  });

  it("converts a flagged non-PKR price with the current rate and keeps the original", async () => {
    const usd = await db().course.create({
      data: { slug: `t${tag}-usd`, title: "Old USD price", summary: "Summary", language: "en", accessType: "PAID", priceAmount: 5000, currency: "USD", originalPriceAmount: 5000, originalCurrency: "USD", priceNeedsReview: true },
    });
    const unknown = await db().course.create({
      data: { slug: `t${tag}-unk`, title: "No currency", summary: "Summary", language: "en", accessType: "PAID", priceAmount: 9000, originalPriceAmount: 9000, priceNeedsReview: true },
    });
    expect((await cur.pricesToReview()).map((c) => c.id)).toEqual(expect.arrayContaining([usd.id, unknown.id]));
    await expect(cur.convertFlaggedPrice(usd.id, cm)).rejects.toThrow(/Super Admins/);
    await expect(cur.convertFlaggedPrice(unknown.id, sa)).rejects.toThrow(/unknown/);
    const pkr = await cur.convertFlaggedPrice(usd.id, sa);
    // $50.00 at Rs 280.00 per dollar = Rs 14,000.
    expect(pkr).toBe(1_400_000);
    expect(await db().course.findUniqueOrThrow({ where: { id: usd.id } })).toMatchObject({
      priceAmount: 1_400_000,
      currency: "PKR",
      originalPriceAmount: 5000,
      originalCurrency: "USD",
      priceNeedsReview: false,
      priceSource: expect.stringContaining("ExchangeRate-API"),
    });
    await expect(cur.convertFlaggedPrice(usd.id, sa)).rejects.toThrow(/doesn't need/);
  });

  it("seeds the starting services once and validates inquiry topics", async () => {
    const services = await catalog.siteServices();
    expect(services.length).toBeGreaterThanOrEqual(9);
    expect(services.map((s) => s.slug)).toEqual(expect.arrayContaining(["international-brand-launch", "llc-marketplace-readiness", "account-reinstatement", "ai-automation", "web-ecommerce"]));
    const reinstatement = services.find((s) => s.slug === "account-reinstatement")!;
    expect(reinstatement.notice).toMatch(/cannot be guaranteed/);
    expect(reinstatement.notice).toMatch(/never ask for your marketplace password/);
    expect(await catalog.isInquiryTopic("account-reinstatement")).toBe(true);
    expect(await catalog.isInquiryTopic("general")).toBe(true);
    expect(await catalog.isInquiryTopic("not-a-service")).toBe(false);

    // Deleting a seeded service doesn't bring it back.
    const row = await db().service.findUniqueOrThrow({ where: { slug: "ai-automation" } });
    await expect(catalog.deleteService(row.id, { id: `t${tag}_x`, role: "INSTRUCTOR" })).rejects.toThrow(/permission/);
    await catalog.deleteService(row.id, cm);
    await catalog.ensureServices();
    expect(await db().service.findUnique({ where: { slug: "ai-automation" } })).toBeNull();
    expect(await catalog.isInquiryTopic("ai-automation")).toBe(false);
  });

  it("manages categories and services with permission checks and unique addresses", async () => {
    const input = catalog.categoryInput.parse({ slug: `t${tag}-cat`, title: "Test category", notice: "No guarantees.", sortOrder: "5", active: true });
    await expect(catalog.saveCategory(null, input, { id: `t${tag}_x`, role: "INSTRUCTOR" })).rejects.toThrow(/permission/);
    const cat = await catalog.saveCategory(null, input, cm);
    await expect(catalog.saveCategory(null, input, cm)).rejects.toThrow(/already uses/);
    const svc = await catalog.saveService(
      null,
      catalog.serviceInput.parse({ slug: `t${tag}-svc`, title: "Test service", summary: "A short summary", offerings: "- One\n\n• Two\nThree", idealFor: "", categoryId: cat.id, sortOrder: "1", status: "DRAFT" }),
      cm,
    );
    expect(catalog.stringList(svc.offerings)).toEqual(["One", "Two", "Three"]);
    expect(await catalog.siteService(`t${tag}-svc`)).toBeNull(); // drafts are not public
    await catalog.saveService(svc.id, catalog.serviceInput.parse({ slug: `t${tag}-svc`, title: "Test service", summary: "A short summary", offerings: "One", categoryId: cat.id, sortOrder: "1", status: "PUBLISHED" }), cm);
    expect(await catalog.siteService(`t${tag}-svc`)).toMatchObject({ title: "Test service", category: { title: "Test category" } });
    await expect(catalog.saveService(null, catalog.serviceInput.parse({ slug: `t${tag}-svc2`, title: "Other", summary: "A short summary", categoryId: "missing", sortOrder: "1", status: "DRAFT" }), cm)).rejects.toThrow(/existing category/);
    // Deleting the category leaves the service uncategorised.
    await catalog.deleteCategory(cat.id, cm);
    expect((await db().service.findUniqueOrThrow({ where: { id: svc.id } })).categoryId).toBeNull();
  });
});
