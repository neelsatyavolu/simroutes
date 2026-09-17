import { describe, expect, it } from "vitest";
import { mergeFlights, normalizeDeparture } from "./normalize";

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

describe("normalizeDeparture", () => {
  it("maps a FIDS departure to a flight record with duration", () => {
    const rec = normalizeDeparture(departure, "EGLL", SEEN);
    expect(rec).toEqual({
      id: "BA117-EGLL-KJFK",
      flightNumber: "BA 117",
      airline: { name: "British Airways", iata: "BA", icao: "BAW" },
      aircraft: "Boeing 777-300ER",
      depIcao: "EGLL",
      arrIcao: "KJFK",
      depLocal: "09:25",
      arrLocal: "12:20",
      durationMin: 475,
      seenAt: SEEN,
    });
  });

  it("uses the board's airport when departure airport is omitted", () => {
    const movement = { scheduledTime: departure.departure.scheduledTime };
    const rec = normalizeDeparture({ ...departure, departure: movement }, "EGLL", SEEN);
    expect(rec?.depIcao).toBe("EGLL");
  });

  it.each([
    ["no aircraft model", { ...departure, aircraft: {} }],
    ["cargo", { ...departure, isCargo: true }],
    ["codeshare", { ...departure, codeshareStatus: "IsCodeshared" }],
    ["no arrival time", { ...departure, arrival: { airport: { icao: "KJFK" } } }],
    ["no arrival icao", { ...departure, arrival: { ...departure.arrival, airport: { iata: "JFK" } } }],
    ["non-positive duration", { ...departure, arrival: { ...departure.arrival, scheduledTime: { utc: "2026-09-16 08:00Z", local: "2026-09-16 04:00-04:00" } } }],
    ["garbage", null],
  ])("skips flights with %s", (_label, input) => {
    expect(normalizeDeparture(input, "EGLL", SEEN)).toBeNull();
  });
});

describe("mergeFlights", () => {
  it("replaces existing records by id and keeps others", () => {
    const a = normalizeDeparture(departure, "EGLL", "2026-09-01T00:00:00.000Z")!;
    const b = { ...a, id: "X1-EGLL-EDDF", flightNumber: "X1" };
    const updated = { ...a, aircraft: "Airbus A350-1000", seenAt: SEEN };
    const merged = mergeFlights([a, b], [updated]);
    expect(merged).toHaveLength(2);
    expect(merged.find((f) => f.id === a.id)?.aircraft).toBe("Airbus A350-1000");
    expect(merged).not.toBe([a, b]);
  });
});
