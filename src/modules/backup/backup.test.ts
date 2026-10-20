import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));

describe("backup helpers", async () => {
  const { sqlString, sqlValue } = await import("./sql-dump");
  const { tarHeader } = await import("./media-archive");

  it("escapes SQL strings so text can't break out of the literal", () => {
    expect(sqlString(`O'Brien \\ "x"\n\r\0\x1a`)).toBe(`'O\\'Brien \\\\ \\"x\\"\\n\\r\\0\\Z'`);
    expect(sqlString("اردو ✓")).toBe("'اردو ✓'");
  });

  it("writes each column type as a MySQL literal", () => {
    expect(sqlValue(null)).toBe("NULL");
    expect(sqlValue(true)).toBe("1");
    expect(sqlValue(12n)).toBe("12");
    expect(sqlValue(new Date("2026-10-20T05:06:07.089Z"))).toBe("'2026-10-20 05:06:07.089'");
    expect(sqlValue(Buffer.from([0, 255]))).toBe("X'00ff'");
    expect(sqlValue({ a: "it's" })).toBe(`'{\\"a\\":\\"it\\'s\\"}'`);
    expect(() => sqlValue(Number.NaN)).toThrow();
  });

  it("builds valid ustar headers, splitting long paths", () => {
    const h = tarHeader("public/2026/a.png", 1234, new Date(0));
    expect(h.length).toBe(512);
    expect(h.subarray(257, 262).toString()).toBe("ustar");
    const stored = parseInt(h.subarray(148, 154).toString(), 8);
    const copy = Buffer.from(h);
    copy.fill(" ", 148, 156);
    expect(stored).toBe(copy.reduce((a, b) => a + b, 0));
    const long = `${"d".repeat(60)}/${"e".repeat(60)}/file.png`;
    const lh = tarHeader(long, 1, new Date(0));
    expect(lh.subarray(345, 345 + 121).toString()).toBe(`${"d".repeat(60)}/${"e".repeat(60)}`);
    expect(() => tarHeader("x".repeat(120), 1, new Date(0))).toThrow(/too long/);
  });
});
