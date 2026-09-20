import { describe, expect, it } from "vitest";
import { groupFlightsByRoute } from "@/lib/route-groups";
import type { FlightResult } from "@/lib/types";

const flight = (id: string, overrides: Partial<FlightResult> = {}): FlightResult => ({
  id, flightNumber: id, airline: { name: "British Airways", iata: "BA", icao: "BAW" },
  aircraft: ["Airbus A320"], depIcao: "EGLL", arrIcao: "EGJJ",
  depLocal: "10:00", arrLocal: "11:00", durationMin: 60, seenAt: "2026-09-20T00:00:00Z",
  dep: null, arr: null, ...overrides,
});

describe("groupFlightsByRoute", () => {
  it("combines airlines and departure times without losing flight details or search order", () => {
    const flights = [
      flight("BA1"),
      flight("BA2", { arrIcao: "KJFK" }),
      flight("LM1", { airline: { name: "Loganair", iata: "LM", icao: "LOG" }, depLocal: "08:00", durationMin: 50 }),
      flight("BA3", { depLocal: "18:00", durationMin: 70 }),
    ];
    const original = structuredClone(flights);
    const groups = groupFlightsByRoute(flights);
    expect(groups.map((g) => g.id)).toEqual(["EGLL-EGJJ", "EGLL-KJFK"]);
    expect(groups[0]).toEqual({
      id: "EGLL-EGJJ", flights: [flights[0], flights[2], flights[3]],
      airlines: ["British Airways", "Loganair"], firstDeparture: "08:00", lastDeparture: "18:00",
      minDuration: 50, maxDuration: 70,
    });
    expect(flights).toEqual(original);
  });

  it("keeps opposite directions separate even without airport metadata", () => {
    expect(groupFlightsByRoute([flight("BA1"), flight("BA2", { depIcao: "EGJJ", arrIcao: "EGLL" })]))
      .toHaveLength(2);
  });

  it("retains distinct flights at the same departure time", () => {
    const [group] = groupFlightsByRoute([flight("BA1"), flight("BA2")]);
    expect(group.flights).toHaveLength(2);
    expect(group.firstDeparture).toBe(group.lastDeparture);
    expect(group.minDuration).toBe(group.maxDuration);
  });

  it("handles no results", () => {
    expect(groupFlightsByRoute([])).toEqual([]);
  });
});
