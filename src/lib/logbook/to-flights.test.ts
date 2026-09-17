import { describe, expect, it } from "vitest";
import type { Airport } from "../types";
import { toLogbookFlights } from "./to-flights";

const ap = (icao: string, iata: string): Airport => ({ icao, iata, name: icao, city: "", country: "", size: "large", lat: 0, lon: 0 });
const airports = new Map([ap("EGLL", "LHR"), ap("KJFK", "JFK"), ap("LOWI", "INN")].map((a) => [a.icao, a]));

const row = (dep: string, arr: string) => ({ dep, arr, aircraft: "B77W", blockMinutes: 470, flownAt: null, externalId: null });

describe("toLogbookFlights", () => {
  it("keeps ICAO codes and converts IATA codes", () => {
    const { flights, errors } = toLogbookFlights([row("EGLL", "JFK"), row("inn", "LHR")], airports);
    expect(errors).toEqual([]);
    expect(flights.map((f) => `${f.depIcao}-${f.arrIcao}`)).toEqual(["EGLL-KJFK", "LOWI-EGLL"]);
    expect(flights[0]).toMatchObject({ aircraft: "B77W", blockMinutes: 470 });
  });

  it("reports airports it cannot find", () => {
    const { flights, errors } = toLogbookFlights([row("XXX", "EGLL"), row("EGLL", "ZZZZ")], airports);
    expect(flights).toEqual([]);
    expect(errors).toEqual(['Unknown airport "XXX" (EGLL route skipped)', 'Unknown airport "ZZZZ" (EGLL route skipped)']);
  });
});
