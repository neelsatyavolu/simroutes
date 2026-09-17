import { z } from "zod";
import type { FlightRecord } from "./types";

// Subset of AeroDataBox's AirportFlightContract (FIDS, withLeg=true) that we rely on.
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
  arrival: movementSchema.extend({
    airport: z.object({ icao: z.string().length(4) }),
  }),
});

/** "2026-09-16 08:25Z" → epoch ms */
const parseUtc = (value: string) => Date.parse(value.replace(" ", "T"));
/** "2026-09-16 09:25+01:00" → "09:25" */
const localClock = (value: string) => value.slice(11, 16);

export function normalizeDeparture(raw: unknown, boardIcao: string, seenAt: string): FlightRecord | null {
  const parsed = fidsFlightSchema.safeParse(raw);
  if (!parsed.success) return null;
  const f = parsed.data;
  if (f.isCargo || (f.codeshareStatus && f.codeshareStatus !== "IsOperator" && f.codeshareStatus !== "Unknown")) {
    return null;
  }

  const durationMin = Math.round(
    (parseUtc(f.arrival.scheduledTime.utc) - parseUtc(f.departure.scheduledTime.utc)) / 60_000,
  );
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null;

  const depIcao = f.departure.airport?.icao ?? boardIcao;
  const arrIcao = f.arrival.airport.icao;
  return {
    id: `${f.number.replace(/\s+/g, "")}-${depIcao}-${arrIcao}`,
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
