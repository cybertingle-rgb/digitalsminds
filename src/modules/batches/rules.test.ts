import { describe, expect, it } from "vitest";
import { availability, dateOnly, formatDay, seatsLeft } from "./rules";

const batch = (over: Partial<Parameters<typeof availability>[0]> = {}) => ({
  status: "OPEN" as const,
  capacity: 10,
  applicationDeadline: null,
  startDate: dateOnly("2027-01-10"),
  ...over,
});

describe("availability", () => {
  it("is open with seats before the deadline", () => {
    expect(availability(batch(), 3, "2027-01-01")).toBe("open");
  });
  it("is full when every seat is taken", () => {
    expect(availability(batch(), 10, "2027-01-01")).toBe("full");
    expect(availability(batch(), 12, "2027-01-01")).toBe("full");
  });
  it("uses the deadline, or the start date when there is none (inclusive)", () => {
    expect(availability(batch({ applicationDeadline: dateOnly("2027-01-05") }), 0, "2027-01-05")).toBe("open");
    expect(availability(batch({ applicationDeadline: dateOnly("2027-01-05") }), 0, "2027-01-06")).toBe("deadline");
    expect(availability(batch(), 0, "2027-01-10")).toBe("open");
    expect(availability(batch(), 0, "2027-01-11")).toBe("deadline");
  });
  it("only open batches take applications", () => {
    for (const status of ["DRAFT", "CLOSED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) expect(availability(batch({ status }), 0, "2027-01-01")).toBe("closed");
  });
});

describe("helpers", () => {
  it("never reports negative seats", () => {
    expect(seatsLeft(10, 4)).toBe(6);
    expect(seatsLeft(10, 11)).toBe(0);
  });
  it("formats calendar days without shifting time zones", () => {
    expect(formatDay(dateOnly("2027-01-10"))).toBe("Jan 10, 2027");
  });
});
