import { describe, expect, it } from "vitest";
import type { Airport, FlightRecord } from "../types";
import { buildProfile, suggestFlights, type LogbookEntry } from "./engine";

const NOW = new Date("2026-09-17T00:00:00Z");

const airport = (icao: string, country: string): Airport => ({
  icao, iata: "", name: icao, city: icao, country, size: "large", lat: 0, lon: 0,
});
const airports = new Map(
  [["EGLL", "GB"], ["EDDF", "DE"], ["LFPG", "FR"], ["LEMD", "ES"], ["LIRF", "IT"], ["KJFK", "US"], ["EHAM", "NL"], ["LSZH", "CH"]]
    .map(([icao, country]) => [icao, airport(icao, country)]),
);

const entry = (over: Partial<LogbookEntry>): LogbookEntry => ({
  depIcao: "EGLL", arrIcao: "EDDF", aircraft: "A20N", blockMinutes: 100, flownAt: "2026-09-10T00:00:00Z", ...over,
});

let n = 0;
const flight = (over: Partial<FlightRecord>): FlightRecord => ({
  id: `F${++n}`, flightNumber: `XX ${n}`, airline: { name: "X", iata: "XX", icao: "XXX" },
  aircraft: ["Airbus A320 NEO"], depIcao: "EDDF", arrIcao: "LFPG", depLocal: "10:00", arrLocal: "11:10",
  durationMin: 70, seenAt: "2026-09-17T00:00:00Z", ...over,
});

describe("buildProfile", () => {
  it("weights recent aircraft higher and finds the last arrival", () => {
    const profile = buildProfile([
      entry({ aircraft: "B738", flownAt: "2025-01-01T00:00:00Z" }),
      entry({ aircraft: "B738", flownAt: "2025-01-02T00:00:00Z" }),
      entry({ aircraft: "A20N", arrIcao: "LEMD", flownAt: "2026-09-15T00:00:00Z" }),
    ], NOW);
    expect(profile.aircraft[0].code).toBe("A20N");
    expect(profile.aircraft.map((a) => a.code)).toContain("B738");
    expect(profile.lastArrival).toBe("LEMD");
    expect(profile.visited).toEqual(new Set(["EGLL", "EDDF", "LEMD"]));
  });

  it("derives a padded typical block-time range", () => {
    const minutes = [60, 70, 80, 90, 100, 110, 120];
    const profile = buildProfile(minutes.map((m) => entry({ blockMinutes: m })), NOW);
    expect(profile.duration).toEqual({ min: 61, max: 124, median: 90 });
  });

  it("uses the last row as the latest flight when dates are missing", () => {
    const profile = buildProfile([entry({ flownAt: null, arrIcao: "EDDF" }), entry({ flownAt: null, arrIcao: "LIRF" })], NOW);
    expect(profile.lastArrival).toBe("LIRF");
    expect(profile.duration).toEqual({ min: 70, max: 130, median: 100 });
  });
});

describe("suggestFlights", () => {
  const profile = buildProfile([
    entry({ depIcao: "EGLL", arrIcao: "EDDF", aircraft: "A20N", blockMinutes: 90 }),
    entry({ depIcao: "EHAM", arrIcao: "EGLL", aircraft: "A20N", blockMinutes: 70, flownAt: "2026-09-01T00:00:00Z" }),
  ], NOW);

  it("continues from the last arrival with the usual aircraft and length, exact type then new destinations first", () => {
    const flights = [
      flight({ id: "wrong-dep", depIcao: "LEMD", arrIcao: "LIRF" }),
      flight({ id: "wrong-type", aircraft: ["Boeing 777-300ER"], arrIcao: "LIRF" }),
      flight({ id: "too-long", arrIcao: "KJFK", durationMin: 500 }),
      flight({ id: "been-there", arrIcao: "EGLL", durationMin: 80 }),
      flight({ id: "new-place", arrIcao: "LIRF", durationMin: 100 }),
      flight({ id: "family", aircraft: ["Airbus A321"], arrIcao: "LSZH", durationMin: 65 }),
    ];
    const { continueFrom } = suggestFlights(profile, flights, airports, { seed: "s" });
    expect(continueFrom?.from).toBe("EDDF");
    expect(continueFrom?.results.map((f) => f.id)).toEqual(["new-place", "been-there", "family"]);
    expect(continueFrom?.relaxed).toEqual([]);
  });

  it("relaxes aircraft and then length when nothing matches, and says so", () => {
    const flights = [flight({ id: "only", aircraft: ["Boeing 777-300ER"], arrIcao: "KJFK", durationMin: 500 })];
    const { continueFrom } = suggestFlights(profile, flights, airports, { seed: "s" });
    expect(continueFrom?.results.map((f) => f.id)).toEqual(["only"]);
    expect(continueFrom?.relaxed).toEqual(["aircraft", "duration"]);
  });

  it("discovers unvisited destinations, one per country", () => {
    const flights = [
      flight({ id: "fr-1", depIcao: "EGLL", arrIcao: "LFPG" }),
      flight({ id: "fr-2", depIcao: "EHAM", arrIcao: "LFPG" }),
      flight({ id: "es", depIcao: "EGLL", arrIcao: "LEMD" }),
      flight({ id: "visited", depIcao: "EGLL", arrIcao: "EDDF" }),
      flight({ id: "wrong-type", depIcao: "EGLL", arrIcao: "LIRF", aircraft: ["Boeing 747-400"] }),
    ];
    const { discover } = suggestFlights(profile, flights, airports, { seed: "s" });
    const ids = discover.results.map((f) => f.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("es");
    expect(ids.filter((id) => id.startsWith("fr"))).toHaveLength(1);
    expect(discover.results.every((f) => f.dep && f.arr)).toBe(true);
  });

  it("doesn't repeat continue-from flights in discover", () => {
    const flights = [
      flight({ id: "from-last", depIcao: "EDDF", arrIcao: "LEMD" }),
      flight({ id: "elsewhere", depIcao: "EGLL", arrIcao: "LIRF" }),
    ];
    const { continueFrom, discover } = suggestFlights(profile, flights, airports, { seed: "s" });
    expect(continueFrom?.results.map((f) => f.id)).toContain("from-last");
    expect(discover.results.map((f) => f.id)).toEqual(["elsewhere"]);
  });

  it("is stable for the same seed", () => {
    const flights = Array.from({ length: 20 }, (_, i) => flight({ id: `d${i}`, depIcao: "EGLL", arrIcao: "LEMD", airline: { name: "X", iata: "X", icao: `X${i}` } }));
    const a = suggestFlights(profile, flights, airports, { seed: "2026-09-17" }).discover.results.map((f) => f.id);
    const b = suggestFlights(profile, flights, airports, { seed: "2026-09-17" }).discover.results.map((f) => f.id);
    expect(a).toEqual(b);
  });
});
