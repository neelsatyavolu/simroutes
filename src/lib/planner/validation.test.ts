import { describe, expect, it } from "vitest";
import { parseNewPlan, parsePlanUpdate } from "./validation";

const TODAY = new Date("2026-09-17T12:00:00Z");

const valid = {
  plannedDate: "2026-09-20",
  flightNumber: "MS 986",
  airline: { name: "EgyptAir", icao: "MSR", iata: "MS" },
  depIcao: "KJFK",
  arrIcao: "HECA",
  aircraft: "Airbus A350-900",
  depLocal: "12:55",
  durationMin: 630,
};

describe("parseNewPlan", () => {
  it("accepts a flight snapshot with a date", () => {
    expect(parseNewPlan(valid, TODAY)).toEqual({
      ok: true,
      plan: {
        plannedDate: "2026-09-20", flightNumber: "MS 986", airlineName: "EgyptAir", airlineIcao: "MSR", airlineIata: "MS",
        depIcao: "KJFK", arrIcao: "HECA", aircraft: "Airbus A350-900", depLocal: "12:55", blockMinutes: 630,
      },
    });
  });

  it.each([
    ["an impossible date", { plannedDate: "2026-02-30" }],
    ["a date in the past", { plannedDate: "2026-09-10" }],
    ["a date over a year away", { plannedDate: "2027-12-01" }],
    ["a bad airport", { depIcao: "JFK" }],
    ["a bad time", { depLocal: "25:00" }],
    ["a missing aircraft", { aircraft: "" }],
  ])("rejects %s", (_label, patch) => {
    expect(parseNewPlan({ ...valid, ...patch }, TODAY).ok).toBe(false);
  });

  it("allows yesterday for timezone slack", () => {
    expect(parseNewPlan({ ...valid, plannedDate: "2026-09-16" }, TODAY).ok).toBe(true);
  });
});

describe("parsePlanUpdate", () => {
  it("accepts a reschedule or marking as flown", () => {
    expect(parsePlanUpdate({ plannedDate: "2026-09-25" }, TODAY)).toEqual({ ok: true, update: { plannedDate: "2026-09-25" } });
    expect(parsePlanUpdate({ status: "flown" }, TODAY)).toEqual({ ok: true, update: { status: "flown" } });
  });

  it("explains why a date is rejected", () => {
    expect(parsePlanUpdate({ plannedDate: "2020-01-01" }, TODAY)).toEqual({ ok: false, error: "Pick a date between today and a year from now" });
  });

  it("accepts marking as unflown without rescheduling", () => {
    expect(parsePlanUpdate({ status: "planned" }, TODAY)).toEqual({ ok: true, update: { status: "planned" } });
  });

  it("rejects empty or unknown changes", () => {
    expect(parsePlanUpdate({}, TODAY).ok).toBe(false);
    expect(parsePlanUpdate({ status: "cancelled" }, TODAY).ok).toBe(false);
  });
});
