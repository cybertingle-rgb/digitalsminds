import { describe, expect, it } from "vitest";
import { isValidTimeZone, zoneLabel, zonedParts, zonedToUtc } from "./timezone";

describe("time zones", () => {
  it("converts wall-clock times in a zone to UTC", () => {
    expect(zonedToUtc("2026-11-01", "18:30", "Asia/Karachi").toISOString()).toBe("2026-11-01T13:30:00.000Z");
    expect(zonedToUtc("2026-11-01", "00:00", "Asia/Karachi").toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z"); // BST
    expect(zonedToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z"); // GMT
    expect(zonedToUtc("2026-12-01", "20:00", "America/New_York").toISOString()).toBe("2026-12-02T01:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "20:00", "UTC").toISOString()).toBe("2026-12-01T20:00:00.000Z");
  });

  it("handles daylight-saving changes", () => {
    // 02:30 doesn't exist in New York on 8 March 2026; it moves forward an hour.
    expect(zonedToUtc("2026-03-08", "02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    // 01:30 happens twice on 1 November 2026; the first (EDT) is used.
    expect(zonedToUtc("2026-11-01", "01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips parts and labels zones", () => {
    const d = zonedToUtc("2026-11-01", "18:30", "Asia/Dubai");
    expect(zonedParts(d, "Asia/Dubai")).toMatchObject({ date: "2026-11-01", time: "18:30" });
    expect(zonedParts(d, "Asia/Karachi")).toMatchObject({ date: "2026-11-01", time: "19:30" });
    expect(zoneLabel("Asia/Karachi")).toBe("PKT");
    expect(zoneLabel("Europe/London", new Date("2026-07-01T00:00:00Z"))).toBe("BST");
    expect(isValidTimeZone("Asia/Karachi")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});
