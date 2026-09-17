import { describe, expect, it } from "vitest";
import { consolidateFlights, mergeAircraftNames } from "./consolidate";
import type { FlightRecord } from "./types";

const SEEN = "2026-09-17T02:00:00Z";

const rec = (over: Partial<FlightRecord>): FlightRecord => ({
  id: "KE81-RKSI-KJFK",
  flightNumber: "KE 81",
  airline: { name: "Korean Air", iata: "KE", icao: "KAL" },
  aircraft: ["Airbus A380-800"],
  depIcao: "RKSI",
  arrIcao: "KJFK",
  depLocal: "10:00",
  arrLocal: "11:00",
  durationMin: 840,
  seenAt: SEEN,
  ...over,
});

describe("mergeAircraftNames", () => {
  it("folds a generic name into its specific variant", () => {
    expect(mergeAircraftNames(["Airbus A380", "Airbus A380-800"])).toEqual(["Airbus A380-800"]);
    expect(mergeAircraftNames(["Airbus A320 (sharklets)", "Airbus A320"])).toEqual(["Airbus A320 (sharklets)"]);
  });

  it("keeps genuinely different types and removes exact repeats", () => {
    expect(mergeAircraftNames(["Airbus A320", "Airbus A320 NEO", "Airbus A320"])).toEqual(["Airbus A320", "Airbus A320 NEO"]);
    expect(mergeAircraftNames(["Boeing 737", "Boeing 737 MAX 8"])).toEqual(["Boeing 737", "Boeing 737 MAX 8"]);
  });
});

describe("consolidateFlights", () => {
  it("collapses one flight seen on several days into a single record with all aircraft", () => {
    const out = consolidateFlights([
      rec({ aircraft: ["Airbus A380"] }),
      rec({ aircraft: ["Airbus A380-800"] }),
      rec({ aircraft: ["Boeing 747-8"] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].aircraft).toEqual(["Airbus A380-800", "Boeing 747-8"]);
  });

  it("uses the most common schedule for times and duration", () => {
    const out = consolidateFlights([
      rec({ depLocal: "10:00", durationMin: 840 }),
      rec({ depLocal: "09:30", durationMin: 870 }),
      rec({ depLocal: "10:00", durationMin: 840 }),
    ]);
    expect(out[0]).toMatchObject({ depLocal: "10:00", durationMin: 840 });
  });

  it("drops a second flight number for the same airline, route and departure time", () => {
    const delta = { name: "Delta Air Lines", iata: "DL", icao: "DAL" };
    const base = { airline: delta, depIcao: "KLAS", arrIcao: "KATL", depLocal: "00:30", aircraft: ["Boeing 757"] };
    const out = consolidateFlights([
      rec({ ...base, id: "DL8770-KLAS-KATL", flightNumber: "DL 8770" }),
      rec({ ...base, id: "DL857-KLAS-KATL", flightNumber: "DL 857" }),
    ]);
    expect(out.map((f) => f.flightNumber)).toEqual(["DL 857"]);
  });

  it("keeps different airlines departing at the same time", () => {
    const out = consolidateFlights([
      rec({}),
      rec({ id: "OZ222-RKSI-KJFK", flightNumber: "OZ 222", airline: { name: "Asiana", iata: "OZ", icao: "AAR" } }),
    ]);
    expect(out).toHaveLength(2);
  });
});
