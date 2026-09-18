import { db } from "../db";

export type LogbookSource = "csv" | "volanta" | "plan";

export interface StoredLogbookFlight {
  id: string;
  depIcao: string;
  arrIcao: string;
  aircraft: string | null;
  blockMinutes: number | null;
  flownAt: string | null;
  source: LogbookSource;
}

export interface NewLogbookFlight {
  depIcao: string;
  arrIcao: string;
  aircraft: string | null;
  blockMinutes: number | null;
  flownAt: string | null;
  externalId: string | null;
}

export const MAX_LOGBOOK_FLIGHTS = 10_000;

/** Same external id, or same route + aircraft + date, counts as the same flight. */
export const dedupeKey = (source: LogbookSource, f: NewLogbookFlight) =>
  f.externalId ? `${source}:${f.externalId}` : [f.depIcao, f.arrIcao, f.aircraft ?? "", f.flownAt ?? ""].join("|");

type Row = { id: string; dep_icao: string; arr_icao: string; aircraft: string | null; block_minutes: number | null; flown_at: Date | null; source: LogbookSource };

export async function listLogbook(userId: string): Promise<StoredLogbookFlight[]> {
  const rows = (await db()`
    SELECT id, dep_icao, arr_icao, aircraft, block_minutes, flown_at, source
    FROM logbook_flights WHERE user_id = ${userId}
    ORDER BY flown_at DESC NULLS LAST, created_at DESC
    LIMIT ${MAX_LOGBOOK_FLIGHTS}`) as Row[];
  return rows.map((r) => ({
    id: r.id,
    depIcao: r.dep_icao,
    arrIcao: r.arr_icao,
    aircraft: r.aircraft,
    blockMinutes: r.block_minutes,
    flownAt: r.flown_at ? new Date(r.flown_at).toISOString() : null,
    source: r.source,
  }));
}

export async function countLogbook(userId: string): Promise<number> {
  const [row] = (await db()`SELECT count(*)::int AS n FROM logbook_flights WHERE user_id = ${userId}`) as { n: number }[];
  return row.n;
}

/** Inserts flights, skipping ones already in the logbook. Returns how many were added. */
export async function addToLogbook(userId: string, source: LogbookSource, flights: readonly NewLogbookFlight[]): Promise<number> {
  if (flights.length === 0) return 0;
  const col = <K extends keyof NewLogbookFlight>(k: K) => flights.map((f) => f[k]);
  const rows = (await db()`
    INSERT INTO logbook_flights (user_id, dep_icao, arr_icao, aircraft, block_minutes, flown_at, source, dedupe_key)
    SELECT ${userId}, dep, arr, aircraft, minutes, flown_at, ${source}, key
    FROM unnest(
      ${col("depIcao")}::text[], ${col("arrIcao")}::text[], ${col("aircraft")}::text[],
      ${col("blockMinutes")}::int[], ${col("flownAt")}::timestamptz[], ${flights.map((f) => dedupeKey(source, f))}::text[]
    ) AS t(dep, arr, aircraft, minutes, flown_at, key)
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id`) as { id: string }[];
  return rows.length;
}

export async function deleteLogbookFlight(userId: string, id: string): Promise<boolean> {
  const rows = (await db()`DELETE FROM logbook_flights WHERE user_id = ${userId} AND id = ${id} RETURNING id`) as unknown[];
  return rows.length > 0;
}

export async function deletePlanLogbookFlight(userId: string, planId: string): Promise<void> {
  await db()`DELETE FROM logbook_flights
    WHERE user_id = ${userId} AND source = 'plan' AND dedupe_key = ${`plan:${planId}`}`;
}

export async function clearLogbook(userId: string): Promise<number> {
  const rows = (await db()`DELETE FROM logbook_flights WHERE user_id = ${userId} RETURNING id`) as unknown[];
  return rows.length;
}
