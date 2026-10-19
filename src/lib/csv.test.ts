import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";
import { pkDay, pkDayStart, pkTodayRange } from "./pk-time";

describe("csvCell", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\",\"x\")")).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvCell("+92 300")).toBe("'+92 300");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
  });
  it("starts with a BOM so Urdu opens correctly in Excel", () => {
    expect(toCsv(["name"], [["علی"]])).toBe("﻿name\r\nعلی\r\n");
  });
});

describe("Pakistan time", () => {
  it("uses PKT calendar days (UTC+5)", () => {
    expect(pkDay(new Date("2026-10-19T18:59:00Z"))).toBe("2026-10-19");
    expect(pkDay(new Date("2026-10-19T19:00:00Z"))).toBe("2026-10-20");
    expect(pkDayStart("2026-10-20").toISOString()).toBe("2026-10-19T19:00:00.000Z");
    const r = pkTodayRange(new Date("2026-10-20T03:00:00Z"));
    expect([r.start.toISOString(), r.end.toISOString()]).toEqual(["2026-10-19T19:00:00.000Z", "2026-10-20T19:00:00.000Z"]);
  });
});
