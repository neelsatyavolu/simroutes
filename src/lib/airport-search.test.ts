import { describe, expect, it } from "vitest";
import { rankAirports, type AirportOption } from "./airport-search";

const ap = (icao: string, iata: string, name: string, city: string, count: number): AirportOption => ({
  icao, iata, name, city, country: "XX", count,
});

const airports = [
  ap("EGLL", "LHR", "London Heathrow Airport", "London", 900),
  ap("EGKK", "LGW", "London Gatwick Airport", "London", 400),
  ap("CYXU", "YXU", "London International Airport", "London", 5),
  ap("LEMD", "MAD", "Adolfo Suárez Madrid–Barajas Airport", "Madrid", 700),
  ap("KLAX", "LAX", "Los Angeles International Airport", "Los Angeles", 800),
  ap("SLLP", "LPB", "El Alto International Airport", "La Paz", 20),
];

const codes = (q: string, limit = 8) => rankAirports(airports, q, limit).map((a) => a.icao);

describe("rankAirports", () => {
  it("returns nothing for an empty query", () => {
    expect(codes("  ")).toEqual([]);
  });

  it("puts an exact ICAO or IATA match first", () => {
    expect(codes("lax")[0]).toBe("KLAX");
    expect(codes("EGLL")[0]).toBe("EGLL");
  });

  it("ranks code prefixes before name matches", () => {
    expect(codes("la")).toEqual(["KLAX", "SLLP"]);
  });

  it("matches city and name words, busiest first", () => {
    expect(codes("london")).toEqual(["EGLL", "EGKK", "CYXU"]);
    expect(codes("madrid")).toEqual(["LEMD"]);
  });

  it("ignores accents and respects the limit", () => {
    expect(codes("suarez")).toEqual(["LEMD"]);
    expect(codes("london", 2)).toEqual(["EGLL", "EGKK"]);
  });
});
