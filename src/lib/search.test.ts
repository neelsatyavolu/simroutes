import { describe, expect, it } from "vitest";
import { parseSearchParams, searchFlights } from "./search";
import type { Airport, FlightRecord, SearchQuery } from "./types";

const airport = (icao: string, iata: string, size: Airport["size"]): Airport => ({
  icao, iata, size, name: `${icao} Intl`, city: "City", country: "XX", lat: 0, lon: 0,
});

const airports = new Map<string, Airport>(
  [airport("EGLL", "LHR", "large"), airport("KJFK", "JFK", "large"), airport("EGJJ", "JER", "medium"), airport("EGHE", "ISC", "small")]
    .map((a) => [a.icao, a]),
);

const flight = (id: string, over: Partial<FlightRecord>): FlightRecord => ({
  id,
  flightNumber: id,
  airline: { name: "British Airways", iata: "BA", icao: "BAW" },
  aircraft: "Airbus A320",
  depIcao: "EGLL",
  arrIcao: "KJFK",
  depLocal: "10:00",
  arrLocal: "12:00",
  durationMin: 60,
  seenAt: "2026-09-16T00:00:00Z",
  ...over,
});

const flights: FlightRecord[] = [
  flight("F1", { aircraft: "Boeing 777-300ER", durationMin: 480, depLocal: "09:00" }),
  flight("F2", { aircraft: "Airbus A320", arrIcao: "EGJJ", durationMin: 55, depLocal: "07:30" }),
  flight("F3", { aircraft: "Airbus A320", depIcao: "EGJJ", arrIcao: "EGHE", durationMin: 35, airline: { name: "Loganair", iata: "LM", icao: "LOG" } }),
  flight("F4", { aircraft: "Airbus A321neo", depIcao: "KJFK", arrIcao: "EGLL", durationMin: 410 }),
];

const query = (over: Partial<SearchQuery> = {}): SearchQuery => ({
  aircraft: [], airlines: [], depSizes: [], arrSizes: [], sort: "duration", limit: 100, ...over,
});

const ids = (q: SearchQuery) => searchFlights(flights, airports, q).results.map((r) => r.id);

describe("searchFlights", () => {
  it("returns everything sorted by duration with no filters", () => {
    expect(ids(query())).toEqual(["F3", "F2", "F4", "F1"]);
  });

  it("filters by one or more aircraft models", () => {
    expect(ids(query({ aircraft: ["Airbus A320"] }))).toEqual(["F3", "F2"]);
    expect(ids(query({ aircraft: ["Airbus A320", "Boeing 777-300ER"] }))).toEqual(["F3", "F2", "F1"]);
  });

  it("filters by departure airport using ICAO or IATA, case-insensitive", () => {
    expect(ids(query({ dep: "lhr" }))).toEqual(["F2", "F1"]);
    expect(ids(query({ dep: "EGLL" }))).toEqual(["F2", "F1"]);
  });

  it("filters by arrival airport", () => {
    expect(ids(query({ arr: "EGLL" }))).toEqual(["F4"]);
  });

  it("applies inclusive duration bounds", () => {
    expect(ids(query({ minDuration: 55, maxDuration: 410 }))).toEqual(["F2", "F4"]);
  });

  it("filters by departure and arrival airport sizes", () => {
    expect(ids(query({ arrSizes: ["medium", "small"] }))).toEqual(["F3", "F2"]);
    expect(ids(query({ depSizes: ["medium"] }))).toEqual(["F3"]);
  });

  it("filters by airline code", () => {
    expect(ids(query({ airlines: ["LM"] }))).toEqual(["F3"]);
  });

  it("combines filters", () => {
    expect(ids(query({ aircraft: ["Airbus A320"], dep: "LHR", maxDuration: 60 }))).toEqual(["F2"]);
  });

  it("sorts by departure time and respects limit while reporting total", () => {
    const res = searchFlights(flights, airports, query({ sort: "departure", limit: 2 }));
    expect(res.results.map((r) => r.id)).toEqual(["F2", "F1"]);
    expect(res.total).toBe(4);
  });

  it("joins airport details", () => {
    const [first] = searchFlights(flights, airports, query({ dep: "EGJJ" })).results;
    expect(first.dep?.iata).toBe("JER");
    expect(first.arr?.size).toBe("small");
  });
});

describe("parseSearchParams", () => {
  it("parses repeated and comma-separated values", () => {
    const p = new URLSearchParams("aircraft=Airbus A320&aircraft=Boeing 737-800&depSize=large,medium&minDuration=30&maxDuration=120&dep=lhr");
    expect(parseSearchParams(p)).toEqual({
      ok: true,
      query: query({
        aircraft: ["Airbus A320", "Boeing 737-800"],
        depSizes: ["large", "medium"],
        minDuration: 30,
        maxDuration: 120,
        dep: "LHR",
      }),
    });
  });

  it("rejects invalid values with a readable error", () => {
    expect(parseSearchParams(new URLSearchParams("depSize=huge")).ok).toBe(false);
    expect(parseSearchParams(new URLSearchParams("minDuration=-5")).ok).toBe(false);
    expect(parseSearchParams(new URLSearchParams("minDuration=200&maxDuration=100")).ok).toBe(false);
    expect(parseSearchParams(new URLSearchParams("dep=TOOLONGCODE")).ok).toBe(false);
  });
});
