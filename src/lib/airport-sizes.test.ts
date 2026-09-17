import { describe, expect, it } from "vitest";
import { classifyAirportSize, type AirportRunway } from "@/lib/airport-sizes";
import { EMPTY_FILTERS, toSearchParams } from "@/lib/filters";
import { parseSearchParams, searchFlights } from "@/lib/search";
import { AIRPORT_SIZES, type Airport, type FlightRecord } from "@/lib/types";

const runway = (length_ft: string, overrides: Partial<AirportRunway> = {}): AirportRunway => ({
  length_ft, surface: "ASP", closed: "0", le_ident: "09", he_ident: "27", ...overrides,
});

describe("airport size classification", () => {
  it("requires both airline role and substantial infrastructure for Super Large", () => {
    const runways = [runway("12000"), runway("9000", { surface: "PEM" })];
    expect(classifyAirportSize("large_airport", true, runways)).toBe("super-large");
    expect(classifyAirportSize("large_airport", false, runways)).toBe("large");
    expect(classifyAirportSize("medium_airport", false, runways)).toBe("medium");
    expect(classifyAirportSize("large_airport", true, [runway("14000")])).toBe("large");
    expect(classifyAirportSize("large_airport", true, [runway("12000"), runway("8999")])).toBe("large");
  });

  it("ignores closed runways, helipads, water and unpaved runways for hub capacity", () => {
    for (const extra of [
      runway("10000", { closed: "1" }), runway("10000", { surface: "Grass" }),
      runway("10000", { le_ident: "H1" }), runway("10000", { surface: "WATER" }),
    ]) {
      expect(classifyAirportSize("large_airport", true, [runway("12000"), extra])).toBe("large");
    }
  });

  it("distinguishes regional, small and short-strip airports at the boundaries", () => {
    expect(classifyAirportSize("medium_airport", true, [runway("5000")])).toBe("medium");
    expect(classifyAirportSize("medium_airport", true, [runway("4999")])).toBe("small");
    expect(classifyAirportSize("medium_airport", true, [runway("3000")])).toBe("small");
    expect(classifyAirportSize("medium_airport", true, [runway("2999")])).toBe("mini");
    expect(classifyAirportSize("small_airport", true, [runway("6000")])).toBe("medium");
    expect(classifyAirportSize("small_airport", false, [runway("6000")])).toBe("small");
  });

  it("does not interpret missing runway information as a tiny airport", () => {
    for (const runways of [[], [runway("")], [runway("unknown")], [runway("0")], [runway("-1")]]) {
      expect(classifyAirportSize("medium_airport", true, runways)).toBe("medium");
      expect(classifyAirportSize("small_airport", false, runways)).toBe("small");
    }
  });
});

describe("five-tier airport filtering", () => {
  const airports = new Map<string, Airport>(AIRPORT_SIZES.map((size, i) => {
    const icao = `APT${i}`;
    return [icao, { icao, iata: "", name: icao, city: "", country: "XX", lat: 0, lon: 0, size }];
  }));
  const flights: FlightRecord[] = [...airports.keys()].map((icao) => ({
    id: icao, flightNumber: "AB1", airline: { name: "Airline", iata: "AB", icao: "ABC" },
    aircraft: [], depIcao: "APT0", arrIcao: icao, depLocal: "12:00", arrLocal: "13:00", durationMin: 60, seenAt: "",
  }));

  it("round-trips new tiers and combines departure and arrival selections", () => {
    const parsed = parseSearchParams(toSearchParams({ ...EMPTY_FILTERS, depSizes: ["super-large"], arrSizes: ["small", "mini"] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(searchFlights(flights, airports, parsed.query).results.map((f) => f.arr?.size)).toEqual(["small", "mini"]);
  });

  it("filters each tier exactly and lets Any size include unknown airports", () => {
    for (const size of AIRPORT_SIZES) {
      const parsed = parseSearchParams(new URLSearchParams({ arrSize: size }));
      if (!parsed.ok) throw new Error(parsed.error);
      expect(searchFlights(flights, airports, parsed.query).results.map((f) => f.arr?.size)).toEqual([size]);
    }
    const unknown = { ...flights[0], id: "unknown", arrIcao: "XXXX" };
    const parsed = parseSearchParams(toSearchParams(EMPTY_FILTERS));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(searchFlights([...flights, unknown], airports, parsed.query).total).toBe(6);
    expect(searchFlights([unknown], airports, { ...parsed.query, arrSizes: ["mini"] }).total).toBe(0);
  });
});
