import { describe, expect, it } from "vitest";
import { chooseCurrency, convertFromPkr, countryFromTimeZone, formatMoney, isFresh, minorDigits } from "./rules";

describe("currency rules", () => {
  it("knows each currency's minor units", () => {
    expect([minorDigits("USD"), minorDigits("JPY"), minorDigits("KWD"), minorDigits("PKR")]).toEqual([2, 0, 3, 2]);
  });

  it("converts PKR paisa to minor units with half-up rounding per currency", () => {
    // Rs 15,000 at 0.0035714 USD per PKR = $53.571 -> 5357 cents
    expect(convertFromPkr(1_500_000, 0.0035714, "USD")).toBe(5357);
    // 0 decimals for yen: Rs 15,000 at 0.5401 = 8101.5 -> 8102
    expect(convertFromPkr(1_500_000, 0.5401, "JPY")).toBe(8102);
    // 3 decimals for dinar: Rs 15,000 at 0.0010955 = 16.4325 KWD -> 16.433 (16433 fils)
    expect(convertFromPkr(1_500_000, 0.0010955, "KWD")).toBe(16433);
    // Classic float trap: 2.675 must round up to 2.68.
    expect(convertFromPkr(100, 2.675, "USD")).toBe(268);
    expect(() => convertFromPkr(100, 0, "USD")).toThrow();
    expect(() => convertFromPkr(100, Number.NaN, "USD")).toThrow();
  });

  it("formats money, dropping cents from 1,000 up and showing PKR as Rs", () => {
    expect(formatMoney(5357, "USD")).toBe("$53.57");
    expect(formatMoney(123456, "USD")).toBe("$1,235");
    expect(formatMoney(1_500_000, "PKR")).toBe("Rs 15,000");
    expect(formatMoney(50_000, "PKR")).toBe("Rs 500");
    expect(formatMoney(8102, "JPY")).toBe("¥8,102");
  });

  it("treats old or future-dated rates as not fresh", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    expect(isFresh("2026-10-24T00:00:00Z", 72, now)).toBe(true);
    expect(isFresh("2026-10-20T00:00:00Z", 72, now)).toBe(false);
    expect(isFresh("2026-10-26T00:00:00Z", 72, now)).toBe(false);
    expect(isFresh("not a date", 72, now)).toBe(false);
  });

  it("chooses the visitor's currency: own choice, then country, else PKR", () => {
    const available = ["USD", "GBP", "EUR"];
    expect(chooseCurrency({ chosen: "GBP", country: "US", available })).toBe("GBP");
    expect(chooseCurrency({ chosen: "PKR", country: "US", available })).toBe("PKR");
    expect(chooseCurrency({ country: "us", available })).toBe("USD");
    expect(chooseCurrency({ country: "DE", available })).toBe("EUR");
    // Country currency not offered or without a fresh rate -> PKR.
    expect(chooseCurrency({ country: "AE", available })).toBe("PKR");
    expect(chooseCurrency({ chosen: "XYZ", country: null, available })).toBe("PKR");
    expect(chooseCurrency({ available: [] })).toBe("PKR");
    expect(chooseCurrency({ country: "PK", available })).toBe("PKR");
  });

  it("guesses a country from main time zones only", () => {
    expect(countryFromTimeZone("Asia/Karachi")).toBe("PK");
    expect(countryFromTimeZone("Europe/London")).toBe("GB");
    expect(countryFromTimeZone("America/Chicago")).toBe("US");
    expect(countryFromTimeZone("Etc/UTC")).toBeNull();
    expect(countryFromTimeZone(undefined)).toBeNull();
  });
});
