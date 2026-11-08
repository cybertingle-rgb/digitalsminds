// Captures the real Digitals Minds student journey for the registration guide.
//
// It needs a running copy of the site on a FRESH, disposable database (never production),
// a local mail catcher (tools/mail-catcher.py) and the one-time setup code. It sets the site
// up through the real admin screens (owner account, email, example payment details, an
// example program and batch), then walks the journey as a fictional student and saves:
//   screenshots/raw/NN-name.png        the plain screenshot
//   screenshots/annotated/NN-name.png  the same with numbered markers
// plus screenshots/manifest.json (what each screenshot shows).
//
//   node capture.mjs --base http://localhost:3000 --mail /path/to/mail-dir --setup-code CODE
//
// All people, numbers and links are fictional test data. See ../README.md.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const B = arg("base", "http://localhost:3000").replace(/\/$/, "");
const MAIL = arg("mail");
const CODE = arg("setup-code");
if (!MAIL || !CODE) throw new Error("Pass --mail <mail-catcher folder> and --setup-code <ADMIN_SETUP_CODE>");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../screenshots");
fs.mkdirSync(`${OUT}/raw`, { recursive: true });
fs.mkdirSync(`${OUT}/annotated`, { recursive: true });
const manifest = [];

// --- Test data (fictional) -------------------------------------------------------------------
const OWNER = { email: "info@digitalsminds.com", password: "Guide-owner-pass-2026" };
const STUDENT = { name: "Ayesha Khan", email: "ayesha.khan@example.com", phone: "0300 1234567", city: "Lahore", cnic: "35202-1234567-1", password: "Ayesha-guide-2026" };
const SECOND = { name: "Bilal Ahmed", email: "bilal.ahmed@example.com", phone: "0321 7654321", city: "Karachi", cnic: "42101-7654321-3" };
const PROGRAM = "eBay Training";
const BATCH = "Batch November 1";
const PDF = (name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
const PNG = { name: "jazzcash-receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64") };

/** Wall-clock date and time in Pakistan, `minutes` from now. */
function pkt(minutes) {
  const d = new Date(Date.now() + minutes * 60_000 + 5 * 3600_000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

// --- Browser helpers -------------------------------------------------------------------------------
const browser = await chromium.launch();
async function open(viewport = { width: 1440, height: 900 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, timezoneId: "Asia/Karachi", locale: "en-GB", reducedMotion: "reduce", ...opts });
  // No first-visit preloader or cookie banner in the screenshots.
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("dm-seen", "1");
      localStorage.setItem("dm_consent", "denied");
    } catch {}
  });
  return ctx.newPage();
}
const hydrated = (page, sel = "form") => page.waitForFunction((s) => Object.keys(document.querySelector(s) ?? {}).some((k) => k.startsWith("__reactProps")), sel);
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
async function login(page, email, password, next) {
  await page.goto(`${B}/login?next=${encodeURIComponent(next)}`);
  await hydrated(page);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("main button[type=submit]");
  await page.waitForURL(`**${next}`);
}

/**
 * Screenshot of the area around `area` (a selector, or "top" for the top of the page),
 * once plain and once with numbered markers on `marks` ([selector, number] pairs).
 */
async function shot(page, name, { area = "top", pad = 28, height, marks = [], title, step }) {
  await settle(page);
  const docBox = async (sel) =>
    page.locator(sel).first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    });
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  let clip;
  if (area === "top") {
    clip = { x: 0, y: 0, width, height: height ?? (await page.evaluate(() => innerHeight)) };
  } else {
    const b = await docBox(area);
    const y = Math.max(0, b.y - pad);
    clip = { x: 0, y, width, height: height ?? b.h + pad * 2 };
  }
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  clip.height = Math.min(clip.height, docH - clip.y);
  await page.screenshot({ path: `${OUT}/raw/${name}.png`, clip, fullPage: true });
  const placed = [];
  for (const [sel, n] of marks) {
    const b = await docBox(sel);
    placed.push({ ...b, n });
  }
  await page.evaluate((items) => {
    const layer = document.createElement("div");
    layer.id = "guide-marks";
    layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
    for (const it of items) {
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;left:${it.x - 6}px;top:${it.y - 6}px;width:${it.w + 12}px;height:${it.h + 12}px;border:3px solid #fdcf31;border-radius:14px;box-shadow:0 0 0 4px rgba(253,207,49,.25),0 6px 24px rgba(43,50,60,.18)`;
      const dot = document.createElement("div");
      dot.textContent = String(it.n);
      dot.style.cssText = `position:absolute;left:${it.x - 20}px;top:${it.y - 20}px;width:30px;height:30px;border-radius:50%;background:#2b323c;color:#fdcf31;font:700 15px/30px Inter,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px #fdcf31,0 4px 12px rgba(0,0,0,.25)`;
      layer.append(box, dot);
    }
    document.body.append(layer);
  }, placed);
  await page.screenshot({ path: `${OUT}/annotated/${name}.png`, clip, fullPage: true });
  await page.evaluate(() => document.getElementById("guide-marks")?.remove());
  manifest.push({ name, title, step, url: page.url().replace(B, ""), marks: marks.map(([s, n]) => ({ n, target: s })) });
  console.log("captured", name);
}

// --- Emails from the mail catcher ---------------------------------------------------------------------
const mailFiles = () => fs.readdirSync(MAIL).filter((f) => f.endsWith(".eml")).sort();
function readMail(file) {
  const py = "import email,sys,json\nm=email.message_from_binary_file(open(sys.argv[1],'rb'))\nh=next(p for p in m.walk() if p.get_content_type()=='text/html')\nprint(json.dumps({'subject':str(email.header.make_header(email.header.decode_header(m['Subject']))),'to':m['To'],'html':h.get_payload(decode=True).decode(h.get_content_charset() or 'utf-8')}))";
  return JSON.parse(execFileSync("python3", ["-I", "-c", py, path.join(MAIL, file)]).toString());
}
async function waitMail(after, to, subjectRe) {
  for (let i = 0; i < 80; i++) {
    for (const f of mailFiles().slice(after)) {
      const m = readMail(f);
      if (m.to.includes(to) && subjectRe.test(m.subject)) return m;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email to ${to} matching ${subjectRe}`);
}
/** The private link in an email (application status or set-password). */
const linkIn = (m) => m.html.match(/href="([^"]*(?:applications\/open\?t=|reset-password\?token=)[^"]+)"/)[1].replace(/&amp;/g, "&");

/** Shows an email as it arrives, with its private link masked. */
async function emailShot(name, m, { title, step, marks = [] }) {
  const page = await open({ width: 760, height: 900 });
  const masked = m.html
    .replace(/(https?:\/\/[^"<\s]*?)(\?t=|\?token=)[A-Za-z0-9_-]+/g, (_, base, q) => `${base.replace(/^https?:\/\/localhost:\d+/, "https://digitalsminds.com")}${q}••••••••••••`)
    .replace(/http:\/\/localhost:\d+/g, "https://digitalsminds.com");
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#eef0f3;font-family:Inter,system-ui,sans-serif">
      <div style="padding:22px 28px 10px;color:#2b323c">
        <div style="font-size:13px;color:#6b7280">From: Digitals Minds &lt;noreply@digitalsminds.com&gt; · To: ${m.to.replace(/</g, "&lt;")}</div>
        <div id="subject" style="font-size:20px;font-weight:700;margin-top:6px">${m.subject.replace(/</g, "&lt;")}</div>
      </div>
      <div id="mail">${masked}</div></body>`,
  );
  await shot(page, name, { area: "body", pad: 0, marks, title, step });
  await page.context().close();
}

// =====================================================================================================
// 1. Owner sets up the site (admin screens; not part of the guide)
// =====================================================================================================
const owner = await open();
await owner.goto(`${B}/setup`);
await hydrated(owner);
await owner.fill("#name", "Digitals Minds Admin");
await owner.fill("#password", OWNER.password);
await owner.fill("#confirmPassword", OWNER.password);
await owner.fill("#code", CODE);
await owner.click("main button[type=submit]");
await owner.waitForURL("**/login?setup=1**");
await login(owner, OWNER.email, OWNER.password, "/admin/integrations");
const emailBox = owner.locator("section[aria-labelledby=email-title]");
await emailBox.locator("#host").fill("localhost");
await emailBox.locator("#port").fill("2525");
await emailBox.locator("input[name=secure]").uncheck();
await emailBox.locator("#username").fill("noreply@test.local");
await emailBox.locator("#password").fill("mail-pass-123");
await emailBox.locator("#fromEmail").fill("noreply@test.local");
await emailBox.getByRole("button", { name: /Save & check/ }).click();
await emailBox.getByText("Saved and connected").waitFor();

// Example payment accounts (not real accounts).
await owner.goto(`${B}/admin/payments/settings`);
await hydrated(owner);
await owner.fill("#bankName", "Meezan Bank");
await owner.fill("#bankAccountTitle", "Digitals Minds");
await owner.fill("#bankAccountNumber", "PK00 MEZN 0000 0000 0000 0000");
await owner.selectOption("#bankQrId", "none");
await owner.fill("#jazzcashTitle", "Digitals Minds");
await owner.fill("#jazzcashNumber", "0300 0000000");
await owner.fill("#easypaisaTitle", "Digitals Minds");
await owner.fill("#easypaisaNumber", "0345 0000000");
await owner.fill("#instructions", "Write your application reference (e.g. DM-XXXX-XXXX) in the payment description if your app allows it.");
await owner.getByRole("button", { name: "Save payment details" }).click();
await owner.getByText("Payment details saved").waitFor();

// Example program, fee and batch.
await owner.goto(`${B}/admin/courses/new`);
await hydrated(owner);
await owner.fill("#title", PROGRAM);
await owner.fill("#summary", "Learn to start and run an eBay store, in live online classes with the Digitals Minds team.");
await owner.getByRole("button", { name: "Create program" }).click();
await owner.waitForURL(/\/admin\/courses\/[^/]+$/);
await hydrated(owner);
await owner.fill("#pricePkr", "1500");
await owner.getByRole("button", { name: "Save fee" }).click();
await owner.getByText(/saved/i).first().waitFor();
await owner.reload();
await hydrated(owner);
await owner.fill("#slug", "ebay-training");
await owner.selectOption("#categoryId", { label: "E-commerce Marketplace Training" });
await owner.fill("#description", "A practical, live online program for people who want to start selling on eBay. Classes are taught live by the Digitals Minds team; you join from home and ask questions as you go.");
await owner.fill("#objectives", "Understand how selling on eBay works\nPrepare your seller account and store\nResearch products and set prices\nCreate clear, effective listings");
await owner.fill("#prerequisites", "A laptop or computer and a stable internet connection.");
await owner.getByRole("button", { name: "Save details" }).click();
await owner.getByText("Program details saved.").waitFor();
await owner.getByRole("button", { name: "Publish" }).click();
await owner.getByText(/published/i).first().waitFor();

await owner.goto(`${B}/admin/batches/new`);
await hydrated(owner);
await owner.selectOption("#courseId", { label: PROGRAM });
await owner.selectOption("#status", "OPEN");
await owner.fill("#name", BATCH);
await owner.fill("#code", "EBAY-NOV1");
await owner.fill("#startDate", "2026-11-16");
await owner.fill("#applicationDeadline", "2026-11-14");
await owner.fill("#scheduleText", "Mon, Wed, Fri · 8:00–10:00 pm");
await owner.fill("#capacity", "30");
await owner.fill("#meetingUrl", "https://meet.google.com/abc-defg-hij");
await owner.fill("#joiningInfo", "Join 5 minutes early from a laptop or computer, with your camera and microphone working. Use your full name when you join so we can let you in.");
await owner.getByRole("button", { name: "Create batch" }).click();
await owner.waitForURL(/\/admin\/batches\/[^/?]+\?created=1/);
const batchUrl = owner.url().split("?")[0];
const batchId = batchUrl.split("/").pop();

await owner.goto(`${B}/admin/onboarding`);
await hydrated(owner);
const step = async (title, description, studentCompletes) => {
  await owner.fill("#title", title);
  await owner.fill("#description", description);
  if (!studentCompletes) await owner.locator("input[name=studentCompletes]").first().uncheck();
  await owner.getByRole("button", { name: "Add step" }).click();
  await owner.getByText("Step added.", { exact: false }).waitFor();
  await owner.waitForTimeout(300);
};
await step("Read the program handbook", "Download it from Documents in your student portal and read it before your first class.", true);
await step("Test your camera and microphone", "Open the class link once before your first class to check that everything works.", true);
await step("Profile details checked", "Our team checks that your profile details match your application.", false);
await owner.goto(`${B}/admin/documents`);
await hydrated(owner);
await owner.fill("#doc-title", "Program handbook");
await owner.fill("#doc-description", "Class rules, how live sessions work and who to contact.");
await owner.selectOption("#doc-scope", { label: `Batch: ${BATCH} (EBAY-NOV1)` });
await owner.setInputFiles("#doc-file", PDF("program-handbook.pdf"));
await owner.getByRole("button", { name: "Upload document" }).click();
await owner.getByText("Uploaded.", { exact: false }).waitFor();

// =====================================================================================================
// 2. A visitor explores and applies
// =====================================================================================================
const visitor = await open();
await visitor.goto(`${B}/`);
await shot(visitor, "01-home", {
  title: "Homepage",
  step: "Explore",
  marks: [
    ["header nav a[href='/courses']", 1],
    ["section[aria-labelledby=featured-title] a[href='/courses'] >> nth=1", 2],
  ],
});
await visitor.goto(`${B}/courses`);
await shot(visitor, "02-programs", { title: "Courses page", step: "Explore", area: "main section", height: 900, marks: [["main article", 1]] });

await visitor.goto(`${B}/courses/ebay-training`);
await shot(visitor, "03-program-top", {
  title: "Program page: overview, fee and batches",
  step: "Program",
  height: 1040,
  marks: [
    ["main h1", 1],
    ["[aria-labelledby=fee-title]", 2],
    ["#batches li", 3],
  ],
});
await shot(visitor, "04-program-details", {
  title: "Program page: what you'll learn and how enrollment works",
  step: "Program",
  area: "#learn-title >> xpath=ancestor::div[contains(@class,'grid')][1]",
  pad: 20,
  height: 900,
  marks: [
    ["#learn-title", 1],
    ["#pre-title", 2],
    ["#how-title", 3],
  ],
});

await visitor.locator("#batches").getByRole("link", { name: "Apply for this batch" }).click();
await visitor.waitForURL("**/courses/ebay-training/apply?batch=*");
await hydrated(visitor);
await visitor.fill("#name", STUDENT.name);
await visitor.fill("#email", STUDENT.email);
await visitor.fill("#phone", STUDENT.phone);
await visitor.fill("#city", STUDENT.city);
await visitor.fill("#cnic", STUDENT.cnic);
await visitor.setInputFiles("#cv", PDF("Ayesha Khan CV.pdf"));
await visitor.fill("#message", "I already sell a few items locally and would like to start on eBay.");
await shot(visitor, "05-apply-form", {
  title: "Application form: your details",
  step: "Apply",
  height: 1080,
  marks: [
    ["#batchId", 1],
    ["#name", 2],
    ["#email", 3],
    ["#phone", 4],
    ["#cnic", 5],
  ],
});
// Submitting without accepting the terms shows the real validation message.
await visitor.click("main form button[type=submit]");
await visitor.getByText("Please accept the Terms and Refund Policy.").waitFor();
await shot(visitor, "06-apply-terms-error", {
  title: "Application form: CV, terms and the send button",
  step: "Apply",
  area: "#cv",
  pad: 70,
  height: 600,
  marks: [
    ["#cv", 1],
    ["#acceptTerms >> xpath=..", 2],
    ["main form button[type=submit]", 3],
  ],
});
await visitor.check("#acceptTerms");
const m0 = mailFiles().length;
await visitor.click("main form button[type=submit]");
await visitor.getByRole("heading", { name: "Check your email" }).waitFor();
await shot(visitor, "07-application-sent", { title: "Application sent", step: "Apply", area: "main h2:has-text('Check your email') >> xpath=ancestor::div[2]", pad: 60, marks: [["main h2:has-text('Check your email')", 1]] });

const confirmMail = await waitMail(m0, STUDENT.email, /^Confirm your application/);
await emailShot("08-email-confirm", confirmMail, { title: "Email: confirm your application", step: "Email", marks: [["#mail a >> nth=0", 1]] });

// The emailed link opens the private application page (it also confirms the email address).
await visitor.goto(linkIn(confirmMail));
await visitor.waitForURL("**/application");
await shot(visitor, "09-status-payment-pending", {
  title: "Your application: payment pending",
  step: "Pay",
  height: 1000,
  marks: [
    ["section[aria-labelledby=summary]", 1],
    ["section[aria-labelledby=stage]", 2],
    ["main aside ol", 3],
  ],
});
await shot(visitor, "10-how-to-pay", {
  title: "How to pay",
  step: "Pay",
  area: "section[aria-labelledby=how-to-pay]",
  pad: 24,
  marks: [["#how-to-pay + p", 1], ["#how-to-pay ~ div >> nth=0", 2]],
});
await hydrated(visitor, "form[enctype='multipart/form-data']");
await visitor.check("input[name=method][value=JAZZCASH]");
await visitor.fill("#reference", "JC-20261107-4821");
await visitor.fill("#payerName", STUDENT.name);
await visitor.setInputFiles("#receipt", PNG);
await shot(visitor, "11-payment-form", {
  title: "Send your payment details",
  step: "Pay",
  area: "section[aria-labelledby=pay-form]",
  pad: 24,
  marks: [
    ["input[name=method][value=JAZZCASH] >> xpath=..", 1],
    ["#reference", 2],
    ["#paidOn", 3],
    ["#receipt", 4],
    ["form[enctype='multipart/form-data'] button[type=submit]", 5],
  ],
});
const m1 = mailFiles().length;
await visitor.click("form[enctype='multipart/form-data'] button[type=submit]");
await visitor.locator("section[aria-labelledby=stage] h2", { hasText: "Payment submitted" }).waitFor();
await visitor.goto(`${B}/application`);
await shot(visitor, "12-status-payment-submitted", {
  title: "Payment submitted: waiting for verification",
  step: "Verify",
  height: 900,
  marks: [["section[aria-labelledby=stage]", 1]],
});
const receivedMail = await waitMail(m1, STUDENT.email, /^We received your payment details/);
await emailShot("13-email-payment-received", receivedMail, { title: "Email: payment details received", step: "Email" });

// A second applicant whose payment can't be verified (to show what that looks like).
const second = await open();
await second.goto(`${B}/courses/ebay-training/apply`);
await hydrated(second);
await second.fill("#name", SECOND.name);
await second.fill("#email", SECOND.email);
await second.fill("#phone", SECOND.phone);
await second.fill("#city", SECOND.city);
await second.fill("#cnic", SECOND.cnic);
await second.setInputFiles("#cv", PDF("cv.pdf"));
await second.check("#acceptTerms");
const m2 = mailFiles().length;
await second.click("main form button[type=submit]");
await second.getByRole("heading", { name: "Check your email" }).waitFor();
await second.goto(linkIn(await waitMail(m2, SECOND.email, /^Confirm your application/)));
await second.waitForURL("**/application");
await hydrated(second, "form[enctype='multipart/form-data']");
await second.check("input[name=method][value=EASYPAISA]");
await second.fill("#reference", "EP-55120931");
await second.setInputFiles("#receipt", PNG);
await second.click("form[enctype='multipart/form-data'] button[type=submit]");
await second.locator("section[aria-labelledby=stage] h2", { hasText: "Payment submitted" }).waitFor();

// =====================================================================================================
// 3. The Super Admin checks the payments (admin screens; not captured)
// =====================================================================================================
const mReject = mailFiles().length;
await owner.goto(`${B}/admin/applications?tab=PAYMENT_SUBMITTED`);
await owner.getByRole("link", { name: SECOND.name }).click();
await owner.waitForURL(/\/admin\/applications\/[^/]+$/);
await hydrated(owner, "main button");
await owner.getByRole("button", { name: "Reject…", exact: true }).click();
await owner.locator("#rejectNote").fill("we couldn't find this transaction ID in our EasyPaisa statement");
await owner.getByRole("button", { name: /Reject payment/ }).click();
await owner.getByText(/rejected/i).first().waitFor();

await owner.goto(`${B}/admin/applications?tab=PAYMENT_SUBMITTED`);
await owner.getByRole("link", { name: STUDENT.name }).click();
await owner.waitForURL(/\/admin\/applications\/[^/]+$/);
await hydrated(owner, "main button");
await owner.getByRole("button", { name: "Verify payment…" }).click();
await owner.fill("#amountReceived", "1500");
const m3 = mailFiles().length;
await owner.getByRole("button", { name: /the money arrived: verify/ }).click();
await owner.getByText("Payment verified.", { exact: false }).waitFor();

// The rejection email carries a fresh link (earlier links stop working).
await second.goto(linkIn(await waitMail(mReject, SECOND.email, /^We couldn.t verify your payment/)));
await second.waitForURL("**/application");
await shot(second, "14-status-payment-not-verified", { title: "If a payment can't be verified", step: "Verify", height: 1000, marks: [["section[aria-labelledby=stage]", 1], ["section[aria-labelledby=pay-form]", 2]] });
await visitor.goto(`${B}/application`);
await shot(visitor, "15-status-enrollment-confirmed", { title: "Enrollment confirmed", step: "Activate", height: 900, marks: [["section[aria-labelledby=stage]", 1]] });

const welcomeMail = await waitMail(m3, STUDENT.email, /^You're enrolled in/);
await emailShot("16-email-welcome", welcomeMail, { title: "Email: you're enrolled — set your password", step: "Email", marks: [["#mail a >> nth=0", 1]] });

// =====================================================================================================
// 4. The student activates the account and uses the portal
// =====================================================================================================
const student = await open();
await student.goto(linkIn(welcomeMail));
await hydrated(student);
await student.fill("#password", STUDENT.password);
await student.fill("#confirmPassword", STUDENT.password);
await shot(student, "17-set-password", {
  title: "Set your password",
  step: "Activate",
  area: "main form >> xpath=ancestor::div[contains(@class,'rounded')][1]",
  pad: 40,
  marks: [["#password", 1], ["#confirmPassword", 2], ["main form button[type=submit]", 3]],
});
await student.click("main form button[type=submit]");
await student.waitForURL("**/login?reset=1");
await hydrated(student);
await student.fill("#email", STUDENT.email);
await student.fill("#password", STUDENT.password);
await shot(student, "18-login", {
  title: "Log in to the student portal",
  step: "Log in",
  area: "main form >> xpath=ancestor::div[contains(@class,'rounded')][1]",
  pad: 40,
  marks: [["#email", 1], ["#password", 2], ["main form button[type=submit]", 3], ["main a[href*='forgot-password']", 4]],
});
await student.click("main form button[type=submit]");
await student.waitForURL("**/account");

// Batch schedule, notice and support reply, added by the team.
await owner.goto(`${B}/admin/live-classes?batch=${batchId}`);
await hydrated(owner);
const addSession = async (kind, title, when, minutes, description) => {
  await owner.selectOption("#kind", kind);
  await owner.fill("#title", title);
  await owner.fill("#date", when.date);
  await owner.fill("#time", when.time);
  await owner.fill("#durationMinutes", String(minutes));
  if (description) await owner.fill("#description", description);
  await owner.getByRole("button", { name: "Add to schedule" }).click();
  await owner.getByText("Added to the schedule.", { exact: false }).waitFor();
  await owner.reload();
  await hydrated(owner);
};
await addSession("EVENT", "Welcome orientation", pkt(10), 45, "Meet the team and your batch, and see how live classes work.");
await addSession("CLASS", "Class 1: How selling on eBay works", { date: "2026-11-16", time: "20:00" }, 120);
await addSession("CLASS", "Class 2: Setting up your seller account", { date: "2026-11-18", time: "20:00" }, 120);
await owner.goto(`${B}/admin/announcements?batch=${batchId}`);
await hydrated(owner);
await owner.fill("#title", "Welcome to Batch November 1");
await owner.fill("#body", "Welcome to the batch! Please complete your onboarding steps and join the welcome orientation from your Schedule page.");
await owner.getByRole("button", { name: "Post announcement" }).click();
await owner.getByText(/Posted to/).waitFor();

await student.goto(`${B}/account`);
await shot(student, "19-dashboard", {
  title: "Your dashboard",
  step: "Portal",
  height: 1100,
  marks: [
    ["main aside nav", 1],
    ["main h2:has-text('eBay Training') >> xpath=ancestor::*[contains(@class,'rounded-3xl')][1]", 2],
    ["section[aria-labelledby=next-live]", 3],
  ],
});

await student.goto(`${B}/account/onboarding`);
await hydrated(student, "main input[type=checkbox]");
await student.getByLabel("Mark as done").first().check();
await student.waitForTimeout(1200);
await student.reload();
await hydrated(student, "main input[type=checkbox]");
await shot(student, "20-onboarding", {
  title: "Onboarding checklist",
  step: "Portal",
  height: 900,
  marks: [
    ["main li:has-text('Read the program handbook')", 1],
    ["main li:has-text('Test your camera')", 2],
    ["main li:has-text('Profile details checked')", 3],
  ],
});
await student.getByLabel("Mark as done").nth(1).check();
await student.waitForTimeout(1200);
// The team confirms its own step; the student becomes an active student.
await owner.goto(batchUrl);
await hydrated(owner, "main input[type=checkbox]");
await owner.getByLabel("Profile details checked").check();
await owner.waitForTimeout(1500);

await student.goto(`${B}/account/program`);
await shot(student, "21-my-program", {
  title: "My program: batch and joining details",
  step: "Batch",
  height: 1150,
  marks: [
    ["main article section >> nth=0", 1],
    ["main h3:has-text('How to join your classes') >> xpath=..", 2],
  ],
});
await student.goto(`${B}/account/schedule`);
await shot(student, "22-schedule", {
  title: "Schedule and joining live sessions",
  step: "Live",
  height: 980,
  marks: [
    ["main a:has-text('Join class')", 1],
    ["main a:has-text('Add to calendar') >> nth=0", 2],
    ["#upcoming-live + ul li >> nth=1", 3],
  ],
});
await student.goto(`${B}/account/documents`);
await shot(student, "23-documents", { title: "Documents", step: "Portal", height: 720, marks: [["main a:has-text('Download')", 1]] });
await student.goto(`${B}/account/notices`);
await shot(student, "24-notices", { title: "Notices", step: "Updates", height: 760, marks: [["main :text('Welcome to Batch November 1') >> xpath=ancestor::*[contains(@class,'rounded')][1]", 1]] });
await student.goto(`${B}/account/notifications`);
await shot(student, "25-notifications", { title: "Notifications", step: "Updates", height: 900 });

await student.goto(`${B}/account/support`);
await hydrated(student);
await student.fill("#subject", "Question about the welcome orientation");
await student.fill("#message", "Hello, I might join the welcome orientation a few minutes late because of work. Is that okay?");
await shot(student, "26-support-new", { title: "Support: send a request", step: "Help", height: 860, marks: [["#subject", 1], ["#message", 2], ["main form button[type=submit]", 3]] });
await student.click("main form button[type=submit]");
await student.waitForURL(/\/account\/support\/[^/]+$/);
const ticketUrl = student.url();
await owner.goto(`${B}/admin/support`);
await owner.getByRole("link", { name: "Question about the welcome orientation" }).click();
await hydrated(owner);
await owner.fill("#body", "Hi Ayesha, that's fine. You can join from your Schedule page while the session is running. Please use your full name so we can let you in.");
await owner.getByRole("button", { name: "Send reply" }).click();
await owner.waitForTimeout(1500);
await student.goto(ticketUrl);
await shot(student, "27-support-reply", { title: "Support: the team's reply", step: "Help", height: 980, marks: [["main :text('Digitals Minds team') >> nth=0", 1], ["#body", 2]] });

await student.goto(`${B}/account/profile`);
await shot(student, "28-profile", { title: "Your profile", step: "Portal", height: 900 });

// Lost the email? The application page can send a new link.
const lost = await open();
await lost.goto(`${B}/application`);
await shot(lost, "29-find-application", { title: "Find your application", step: "Help", height: 760, marks: [["main form", 1]] });

// Phone view of the dashboard.
const phone = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
await login(phone, STUDENT.email, STUDENT.password, "/account/schedule");
await shot(phone, "30-phone-schedule", { title: "The portal on a phone", step: "Portal", height: 1400 });

// Playwright's PNGs are large; store them as 256-colour palette PNGs at quality 95
// (visually identical at full size, about a quarter of the size, so the repository stays light).
const sharp = (await import("sharp")).default;
for (const dir of ["raw", "annotated"]) {
  for (const f of fs.readdirSync(`${OUT}/${dir}`)) {
    const file = `${OUT}/${dir}/${f}`;
    fs.writeFileSync(file, await sharp(fs.readFileSync(file)).png({ palette: true, quality: 95, effort: 10, dither: 1, compressionLevel: 9 }).toBuffer());
  }
}
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ capturedAt: new Date().toISOString(), base: B, screenshots: manifest }, null, 2));
console.log(`\n${manifest.length} screenshots saved in ${OUT}`);
await browser.close();
