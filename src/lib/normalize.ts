import { z } from "zod";
import type { FlightRecord } from "./types";

export interface Board {
  icao: string;
  direction: "Departure" | "Arrival";
}

// Subset of AeroDataBox's AirportFlightContract (FIDS, withLeg=true) that we rely on.
// The board's own airport is usually omitted on its side of the flight.
const movementSchema = z.object({
  airport: z.object({ icao: z.string().length(4).optional() }).optional(),
  scheduledTime: z.object({ utc: z.string(), local: z.string() }),
});

const fidsFlightSchema = z.object({
  number: z.string().min(1),
  isCargo: z.boolean().optional(),
  codeshareStatus: z.string().optional(),
  aircraft: z.object({ model: z.string().min(1) }),
  airline: z.object({
    name: z.string().default(""),
    iata: z.string().default(""),
    icao: z.string().default(""),
  }),
  departure: movementSchema,
  arrival: movementSchema,
});

/** "2026-09-16 08:25Z" → epoch ms */
const parseUtc = (value: string) => Date.parse(value.replace(" ", "T"));
/** "2026-09-16 09:25+01:00" → "09:25" */
const localClock = (value: string) => value.slice(11, 16);
const compact = (value: string) => value.replace(/\s+/g, "");

export function normalizeFlight(raw: unknown, board: Board, seenAt: string): FlightRecord | null {
  const parsed = fidsFlightSchema.safeParse(raw);
  if (!parsed.success) return null;
  const f = parsed.data;
  if (f.isCargo || (f.codeshareStatus && f.codeshareStatus !== "IsOperator" && f.codeshareStatus !== "Unknown")) {
    return null;
  }

  const isDeparture = board.direction === "Departure";
  const depIcao = f.departure.airport?.icao ?? (isDeparture ? board.icao : undefined);
  const arrIcao = f.arrival.airport?.icao ?? (isDeparture ? undefined : board.icao);
  if (!depIcao || !arrIcao) return null;

  const durationMin = Math.round(
    (parseUtc(f.arrival.scheduledTime.utc) - parseUtc(f.departure.scheduledTime.utc)) / 60_000,
  );
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null;

  return {
    id: `${compact(f.number)}-${depIcao}-${arrIcao}-${compact(f.aircraft.model)}`,
    flightNumber: f.number,
    airline: f.airline,
    aircraft: f.aircraft.model,
    depIcao,
    arrIcao,
    depLocal: localClock(f.departure.scheduledTime.local),
    arrLocal: localClock(f.arrival.scheduledTime.local),
    durationMin,
    seenAt,
  };
}

/** Returns a new list where incoming records replace existing ones with the same id. */
export function mergeFlights(existing: readonly FlightRecord[], incoming: readonly FlightRecord[]): FlightRecord[] {
  const byId = new Map(existing.map((f) => [f.id, f]));
  for (const f of incoming) byId.set(f.id, f);
  return [...byId.values()];
}

/** Drops records retrieved more than maxAgeMs ago (AeroDataBox allows caching for at most 7 days). */
export function pruneExpired(flights: readonly FlightRecord[], now: Date, maxAgeMs: number): FlightRecord[] {
  const cutoff = now.getTime() - maxAgeMs;
  return flights.filter((f) => Date.parse(f.seenAt) >= cutoff);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time FIDS windows (max 12h each) covering `days` whole days from startDate (YYYY-MM-DD). */
export function buildWindows(startDate: string, days: number): { from: string; to: string }[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return [
      { from: `${date}T00:00`, to: `${date}T11:59` },
      { from: `${date}T12:00`, to: `${date}T23:59` },
    ];
  }).flat();
}
