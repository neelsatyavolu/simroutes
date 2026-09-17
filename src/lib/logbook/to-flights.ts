import type { Airport } from "../types";
import type { ParsedLogbookRow } from "./parse-csv";
import type { NewLogbookFlight } from "./repo";

const iataIndexes = new WeakMap<ReadonlyMap<string, Airport>, Map<string, string>>();

function iataIndex(airports: ReadonlyMap<string, Airport>): Map<string, string> {
  let index = iataIndexes.get(airports);
  if (!index) {
    index = new Map();
    for (const a of airports.values()) if (a.iata && !index.has(a.iata)) index.set(a.iata, a.icao);
    iataIndexes.set(airports, index);
  }
  return index;
}

/** Resolves ICAO or IATA to a known ICAO code. */
export function resolveAirportCode(code: string, airports: ReadonlyMap<string, Airport>): string | null {
  const upper = code.trim().toUpperCase();
  if (airports.has(upper)) return upper;
  return upper.length === 3 ? iataIndex(airports).get(upper) ?? null : null;
}

export function toLogbookFlights(
  rows: readonly ParsedLogbookRow[],
  airports: ReadonlyMap<string, Airport>,
): { flights: NewLogbookFlight[]; errors: string[] } {
  const flights: NewLogbookFlight[] = [];
  const errors: string[] = [];
  for (const r of rows) {
    const depIcao = resolveAirportCode(r.dep, airports);
    const arrIcao = resolveAirportCode(r.arr, airports);
    if (!depIcao || !arrIcao) {
      const [bad, other] = depIcao ? [r.arr, depIcao] : [r.dep, arrIcao ?? r.arr];
      errors.push(`Unknown airport "${bad}" (${other} route skipped)`);
      continue;
    }
    flights.push({ depIcao, arrIcao, aircraft: r.aircraft, blockMinutes: r.blockMinutes, flownAt: r.flownAt, externalId: r.externalId });
  }
  return { flights, errors };
}
