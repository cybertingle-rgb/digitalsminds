// Builds ../Digitals_Minds_Student_Registration_Guide.pdf from guide.html (16:9 pages, 1280 × 720 px).
//   node build.mjs
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE if it isn't installed in this folder).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../Digitals_Minds_Student_Registration_Guide.pdf");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// Screenshots are kept as full-resolution PNGs; the PDF gets high-quality JPEG copies
// (at most 1800 px wide, ample for a frame under 900 px), which keeps the file shareable.
const sharp = (await import("sharp")).default;
await page.route(/\/screenshots\/(raw|annotated)\/[^/]+\.png$/, async (route) => {
  const file = decodeURIComponent(new URL(route.request().url()).pathname);
  const body = await sharp(fs.readFileSync(file)).resize({ width: 1800, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  await route.fulfill({ status: 200, contentType: "image/jpeg", body });
});
await page.goto(pathToFileURL(path.join(HERE, "guide.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// Every screenshot must have loaded; a missing file fails the build instead of printing a blank frame.
const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")));
if (broken.length) throw new Error(`Images not found: ${broken.join(", ")}`);
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`));
if (!fonts.some((f) => f.startsWith("Inter"))) throw new Error("Inter fonts did not load");
await page.pdf({ path: OUT, width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`PDF written: ${OUT}`);
