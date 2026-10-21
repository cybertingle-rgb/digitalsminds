import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/settings/integrations", () => ({ getSmtpConfig: async () => null }));

let failures: { code: string }[] = [];
let attempts = 0;
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async () => {
        attempts++;
        const f = failures.shift();
        if (f) throw Object.assign(new Error(f.code), f);
      },
    }),
  },
}));

const { sendMail } = await import("./mailer");
const cfg = { host: "h", port: 465, secure: true, username: "u", password: "p", fromName: "DM", fromEmail: "a@b.c" };
const mail = { to: "x@y.z", subject: "s", html: "h", text: "t" };

describe("sendMail", () => {
  beforeEach(() => {
    failures = [];
    attempts = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("retries once after a connection timeout", async () => {
    failures = [{ code: "ETIMEDOUT" }];
    await sendMail(mail, cfg);
    expect(attempts).toBe(2);
  });

  it("gives up after the second connection failure", async () => {
    failures = [{ code: "ECONNECTION" }, { code: "ECONNECTION" }];
    await expect(sendMail(mail, cfg)).rejects.toMatchObject({ code: "ECONNECTION" });
    expect(attempts).toBe(2);
  });

  it("does not retry a rejected login", async () => {
    failures = [{ code: "EAUTH" }];
    await expect(sendMail(mail, cfg)).rejects.toMatchObject({ code: "EAUTH" });
    expect(attempts).toBe(1);
  });
});
