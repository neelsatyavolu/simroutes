import { describe, expect, it } from "vitest";
import { buildWindows, mergeFlights, normalizeFlight, pruneExpired } from "./normalize";
import type { FlightRecord } from "./types";

const SEEN = "2026-09-16T12:00:00.000Z";

const departure = {
  number: "BA 117",
  isCargo: false,
  codeshareStatus: "IsOperator",
  aircraft: { model: "Boeing 777-300ER" },
  airline: { name: "British Airways", iata: "BA", icao: "BAW" },
  departure: {
    airport: { icao: "EGLL", iata: "LHR" },
    scheduledTime: { utc: "2026-09-16 08:25Z", local: "2026-09-16 09:25+01:00" },
  },
  arrival: {
    airport: { icao: "KJFK", iata: "JFK" },
    scheduledTime: { utc: "2026-09-16 16:20Z", local: "2026-09-16 12:20-04:00" },
  },
};

const EXPECTED: FlightRecord = {
  id: "BA117-EGLL-KJFK-Boeing777-300ER",
  flightNumber: "BA 117",
  airline: { name: "British Airways", iata: "BA", icao: "BAW" },
  aircraft: "Boeing 777-300ER",
  depIcao: "EGLL",
  arrIcao: "KJFK",
  depLocal: "09:25",
  arrLocal: "12:20",
  durationMin: 475,
  seenAt: SEEN,
};

describe("normalizeFlight", () => {
  it("maps a departures-board flight to a record with duration", () => {
    expect(normalizeFlight(departure, { icao: "EGLL", direction: "Departure" }, SEEN)).toEqual(EXPECTED);
  });

  it("fills the board's airport on the departure side for departures", () => {
    const raw = { ...departure, departure: { scheduledTime: departure.departure.scheduledTime } };
    expect(normalizeFlight(raw, { icao: "EGLL", direction: "Departure" }, SEEN)).toEqual(EXPECTED);
  });

  it("fills the board's airport on the arrival side for arrivals", () => {
    const raw = { ...departure, arrival: { scheduledTime: departure.arrival.scheduledTime } };
    expect(normalizeFlight(raw, { icao: "KJFK", direction: "Arrival" }, SEEN)).toEqual(EXPECTED);
  });

  it("gives the same id whichever board the flight was seen on", () => {
    const fromArrivals = normalizeFlight(
      { ...departure, arrival: { scheduledTime: departure.arrival.scheduledTime } },
      { icao: "KJFK", direction: "Arrival" },
      SEEN,
    );
    expect(fromArrivals?.id).toBe(EXPECTED.id);
  });

  it("keeps different aircraft on the same flight as separate records", () => {
    const other = normalizeFlight({ ...departure, aircraft: { model: "Boeing 787-10" } }, { icao: "EGLL", direction: "Departure" }, SEEN);
    expect(other?.id).not.toBe(EXPECTED.id);
  });

  const board = { icao: "EGLL", direction: "Departure" } as const;
  it.each([
    ["no aircraft model", { ...departure, aircraft: {} }],
    ["cargo", { ...departure, isCargo: true }],
    ["codeshare", { ...departure, codeshareStatus: "IsCodeshared" }],
    ["no arrival time", { ...departure, arrival: { airport: { icao: "KJFK" } } }],
    ["no far-side icao", { ...departure, arrival: { ...departure.arrival, airport: { iata: "JFK" } } }],
    ["non-positive duration", { ...departure, arrival: { ...departure.arrival, scheduledTime: { utc: "2026-09-16 08:00Z", local: "2026-09-16 04:00-04:00" } } }],
    ["garbage", null],
  ])("skips flights with %s", (_label, input) => {
    expect(normalizeFlight(input, board, SEEN)).toBeNull();
  });

  it("skips arrivals with no origin airport", () => {
    const raw = { ...departure, departure: { scheduledTime: departure.departure.scheduledTime }, arrival: { scheduledTime: departure.arrival.scheduledTime } };
    expect(normalizeFlight(raw, { icao: "KJFK", direction: "Arrival" }, SEEN)).toBeNull();
  });
});

describe("mergeFlights", () => {
  it("replaces existing records by id and keeps others", () => {
    const a = { ...EXPECTED, seenAt: "2026-09-01T00:00:00.000Z" };
    const b = { ...a, id: "X1", flightNumber: "X1" };
    const updated = { ...a, depLocal: "10:00", seenAt: SEEN };
    const merged = mergeFlights([a, b], [updated]);
    expect(merged).toHaveLength(2);
    expect(merged.find((f) => f.id === a.id)?.depLocal).toBe("10:00");
  });
});

describe("pruneExpired", () => {
  it("drops records older than the max age", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    const fresh = { ...EXPECTED, id: "fresh", seenAt: "2026-09-15T00:00:00Z" };
    const stale = { ...EXPECTED, id: "stale", seenAt: "2026-09-12T23:59:59Z" };
    const kept = pruneExpired([fresh, stale], now, 7 * 24 * 3600_000);
    expect(kept.map((f) => f.id)).toEqual(["fresh"]);
  });
});

describe("buildWindows", () => {
  it("splits each day into two local 12h windows", () => {
    expect(buildWindows("2026-12-31", 2)).toEqual([
      { from: "2026-12-31T00:00", to: "2026-12-31T11:59" },
      { from: "2026-12-31T12:00", to: "2026-12-31T23:59" },
      { from: "2027-01-01T00:00", to: "2027-01-01T11:59" },
      { from: "2027-01-01T12:00", to: "2027-01-01T23:59" },
    ]);
  });
});
