import { describe, expect, it } from "vitest";
import { inquiryInputSchema } from "./schema";

const valid = {
  name: "  Ayesha Khan ",
  email: "Ayesha@Example.com",
  service: "web-ecommerce",
  message: "I would like a quote for an online store.",
};

describe("inquiryInputSchema", () => {
  it("accepts and normalises a valid inquiry", () => {
    const r = inquiryInputSchema.parse({ ...valid, phone: "", company: "" });
    expect(r.name).toBe("Ayesha Khan");
    expect(r.email).toBe("ayesha@example.com");
    expect(r.phone).toBeUndefined();
    expect(r.company).toBeUndefined();
  });

  it("accepts the general service option", () => {
    expect(inquiryInputSchema.safeParse({ ...valid, service: "general" }).success).toBe(true);
  });

  it.each([
    ["email", "not-an-email"],
    ["service", "hacking"],
    ["message", "short"],
    ["name", "A"],
    ["phone", "call me maybe"],
  ])("rejects an invalid %s", (field, value) => {
    const r = inquiryInputSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual([field]);
  });

  it("rejects oversized messages", () => {
    expect(inquiryInputSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
  });
});
