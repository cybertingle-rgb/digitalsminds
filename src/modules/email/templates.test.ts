import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { actionEmail } from "./templates";

describe("actionEmail", () => {
  it("escapes user-provided values and includes a plain-text version", () => {
    const mail = actionEmail({
      dict: en,
      locale: "en",
      to: "a@example.com",
      name: '<script>alert("x")</script>',
      subject: en.emails.verifySubject,
      intro: en.emails.verifyIntro,
      buttonLabel: en.emails.verifyButton,
      url: "https://digitalsminds.com/api/auth/verify-email?token=abc&callbackURL=/login",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("token=abc&amp;callbackURL");
    expect(mail.text).toContain("https://digitalsminds.com/api/auth/verify-email?token=abc&callbackURL=/login");
    expect(mail.subject).toBe("Verify your email for Digitals Minds");
  });

  it("never lays emails out right-to-left (Urdu interface removed)", () => {
    const mail = actionEmail({ dict: en, locale: "ur", to: "a@example.com", name: "علی", subject: "s", intro: "i", buttonLabel: "b", url: "https://x.test" });
    expect(mail.html).not.toContain('dir="rtl"');
  });
});
