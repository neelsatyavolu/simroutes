import { z } from "zod";
import { AIRPORT_SIZES, type Airport, type FlightRecord, type SearchQuery, type SearchResponse } from "./types";

const MAX_LIMIT = 500;

const normalizeFlightNumber = (value: string) => value.replace(/\s/g, "").toUpperCase();

const listParam = <T extends z.ZodType<unknown, string>>(item: T) =>
  z.array(z.string()).transform((values) =>
    values.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean),
  ).pipe(z.array(item));

const airportCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{3,4}$/, "Airport must be a 3-letter IATA or 4-letter ICAO code")
  .transform((v) => v.toUpperCase())
  .optional();

const minutes = z.coerce.number().int().min(0).max(24 * 60).optional();

const querySchema = z
  .object({
    flightNumber: z.string().transform(normalizeFlightNumber).optional(),
    aircraft: z.array(z.string()).transform((v) => v.map((s) => s.trim()).filter(Boolean)),
    airlines: listParam(z.string().max(3)),
    dep: airportCode,
    arr: airportCode,
    minDuration: minutes,
    maxDuration: minutes,
    depSizes: listParam(z.enum(AIRPORT_SIZES)),
    arrSizes: listParam(z.enum(AIRPORT_SIZES)),
    sort: z.enum(["duration", "departure", "airline"]).default("duration"),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(100),
  })
  .refine((q) => q.minDuration === undefined || q.maxDuration === undefined || q.minDuration <= q.maxDuration, {
    message: "Minimum duration must be less than or equal to maximum duration",
  });

export type ParseResult = { ok: true; query: SearchQuery } | { ok: false; error: string };

export function parseSearchParams(params: URLSearchParams): ParseResult {
  const single = (key: string) => params.get(key) || undefined;
  const parsed = querySchema.safeParse({
    flightNumber: single("flightNumber"),
    // Aircraft models contain no commas but may contain spaces, so only repeated params are used.
    aircraft: params.getAll("aircraft"),
    airlines: params.getAll("airline"),
    dep: single("dep"),
    arr: single("arr"),
    minDuration: single("minDuration"),
    maxDuration: single("maxDuration"),
    depSizes: params.getAll("depSize"),
    arrSizes: params.getAll("arrSize"),
    sort: single("sort"),
    limit: single("limit"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { flightNumber, dep, arr, minDuration, maxDuration, ...rest } = parsed.data;
  // Drop undefined keys so the query shape stays minimal and predictable.
  return {
    ok: true,
    query: {
      ...rest,
      ...(flightNumber && { flightNumber }),
      ...(dep && { dep }),
      ...(arr && { arr }),
      ...(minDuration !== undefined && { minDuration }),
      ...(maxDuration !== undefined && { maxDuration }),
    },
  };
}

const matchesAirport = (code: string | undefined, icao: string, airport: Airport | null) =>
  !code || code === icao || code === airport?.iata;

const matchesSize = (sizes: SearchQuery["depSizes"], airport: Airport | null) =>
  sizes.length === 0 || (airport !== null && sizes.includes(airport.size));

const COMPARATORS: Record<SearchQuery["sort"], (a: FlightRecord, b: FlightRecord) => number> = {
  duration: (a, b) => a.durationMin - b.durationMin,
  departure: (a, b) => a.depLocal.localeCompare(b.depLocal),
  airline: (a, b) => a.airline.name.localeCompare(b.airline.name) || a.durationMin - b.durationMin,
};

export function searchFlights(
  flights: readonly FlightRecord[],
  airports: ReadonlyMap<string, Airport>,
  q: SearchQuery,
): SearchResponse {
  const aircraft = new Set(q.aircraft);
  const flightNumber = normalizeFlightNumber(q.flightNumber ?? "");
  const airlines = new Set(q.airlines.map((a) => a.toUpperCase()));
  const dep = q.dep?.toUpperCase();
  const arr = q.arr?.toUpperCase();

  const matches = flights
    .map((f) => ({ ...f, dep: airports.get(f.depIcao) ?? null, arr: airports.get(f.arrIcao) ?? null }))
    .filter(
      (f) =>
        (!flightNumber || normalizeFlightNumber(f.flightNumber).includes(flightNumber)) &&
        (aircraft.size === 0 || f.aircraft.some((a) => aircraft.has(a))) &&
        (airlines.size === 0 || airlines.has(f.airline.iata) || airlines.has(f.airline.icao)) &&
        matchesAirport(dep, f.depIcao, f.dep) &&
        matchesAirport(arr, f.arrIcao, f.arr) &&
        (q.minDuration === undefined || f.durationMin >= q.minDuration) &&
        (q.maxDuration === undefined || f.durationMin <= q.maxDuration) &&
        matchesSize(q.depSizes, f.dep) &&
        matchesSize(q.arrSizes, f.arr),
    )
    .sort(COMPARATORS[q.sort]);

  return { total: matches.length, results: matches.slice(0, q.limit) };
}
