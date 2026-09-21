import { z } from "zod";
import type { ParsedLogbookRow } from "./parse-csv";

/**
 * Volanta has no official export. This uses the public profile endpoint its own website calls,
 * and deliberately only requests the latest 5 flights (the limit Volanta applies to public access).
 */
export const VOLANTA_FLIGHT_LIMIT = 5;
const TIMEOUT_MS = 8_000;

const USERNAME = /^[A-Za-z0-9_.-]{2,40}$/;
export const isValidVolantaUsername = (name: string) => USERNAME.test(name) && !name.includes("..");

const airport = z.object({ icaoCode: z.string().nullish() }).nullish();
export const volantaResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      offBlocksTime: z.string().nullish(),
      onBlocksTime: z.string().nullish(),
      origin: airport,
      destination: airport,
      aircraft: z.object({ aircraftTypeIcao: z.string().nullish() }).nullish(),
    }),
  ),
});

/** Volanta timestamps are UTC without a zone designator. */
const utc = (value: string | null | undefined) => {
  if (!value) return null;
  const ms = Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(ms) ? ms : null;
};

export function mapVolantaFlights(payload: unknown): ParsedLogbookRow[] {
  const parsed = volantaResponseSchema.safeParse(payload);
  if (!parsed.success) return [];
  return parsed.data.items.flatMap((f) => {
    const dep = f.origin?.icaoCode?.toUpperCase();
    const arr = f.destination?.icaoCode?.toUpperCase();
    if (!dep || !arr) return [];
    const off = utc(f.offBlocksTime);
    const on = utc(f.onBlocksTime);
    const minutes = off !== null && on !== null ? Math.round((on - off) / 60_000) : null;
    return [{
      dep,
      arr,
      aircraft: f.aircraft?.aircraftTypeIcao ?? null,
      blockMinutes: minutes && minutes > 0 ? minutes : null,
      flownAt: off !== null ? new Date(off).toISOString() : null,
      externalId: f.id,
    }];
  });
}

export class VolantaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function fetchRecentVolantaFlights(username: string): Promise<ParsedLogbookRow[]> {
  if (!isValidVolantaUsername(username)) throw new VolantaError("That doesn't look like a Volanta username", 400);
  const params = new URLSearchParams({
    Page: "1",
    PageSize: String(VOLANTA_FLIGHT_LIMIT),
    SortField: "OffBlocksTime",
    Ascending: "false",
    RemoveNulls: "false",
  });
  let res: Response;
  try {
    res = await fetch(`https://api.volanta.app/api/v1/Profiles/${encodeURIComponent(username)}/Flights/Search?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new VolantaError(`Couldn't reach Volanta (${(error as Error).message})`, 502);
  }
  if (res.status === 404) throw new VolantaError("No public Volanta profile with that username", 404);
  if (!res.ok) throw new VolantaError(`Volanta returned an error (${res.status})`, 502);
  return mapVolantaFlights(await res.json());
}
