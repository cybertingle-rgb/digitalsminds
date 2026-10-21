import { describe, expect, it } from "vitest";
import { formatCnic, hashToken, looksLikeToken, maskCnic, newReference, newToken, normaliseReference, stageIndex, transactionKey } from "./rules";

describe("admissions rules", () => {
  it("formats and validates CNIC numbers", () => {
    expect(formatCnic("3520212345671")).toBe("35202-1234567-1");
    expect(formatCnic(" 35202-1234567-1 ")).toBe("35202-1234567-1");
    expect(formatCnic("35202 1234567 1")).toBe("35202-1234567-1");
    expect(formatCnic("35202-123456-1")).toBeNull();
    expect(formatCnic("abcde-1234567-1")).toBeNull();
    expect(maskCnic("35202-1234567-1")).toBe("35202-*******-1");
  });

  it("makes readable, unambiguous references", () => {
    for (let i = 0; i < 200; i++) expect(newReference()).toMatch(/^DM-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
    expect(normaliseReference(" dm-7kq4-xz2m ")).toBe("DM-7KQ4-XZ2M");
  });

  it("issues random tokens and stores only a hash", () => {
    const a = newToken();
    expect(looksLikeToken(a)).toBe(true);
    expect(a).not.toBe(newToken());
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikeToken("short")).toBe(false);
    expect(looksLikeToken(`${a}"`)).toBe(false);
  });

  it("treats the same reference by the same method as one transaction", () => {
    expect(transactionKey("JAZZCASH", " 123-456 789 ")).toBe(transactionKey("JAZZCASH", "123456789"));
    expect(transactionKey("JAZZCASH", "abc")).toBe(transactionKey("JAZZCASH", "ABC"));
    expect(transactionKey("JAZZCASH", "1")).not.toBe(transactionKey("EASYPAISA", "1"));
  });

  it("orders the stages", () => {
    expect(stageIndex("PAYMENT_SUBMITTED")).toBeLessThan(stageIndex("ENROLLMENT_CONFIRMED"));
    expect(stageIndex("REJECTED")).toBe(-1);
  });
});
