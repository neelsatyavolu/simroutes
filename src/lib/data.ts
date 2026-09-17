import { readFile } from "node:fs/promises";
import path from "node:path";
import { MAX_RETENTION_MS, readFlightsFile, type FlightsFile } from "./flight-store";
import { pruneExpired } from "./normalize";
import type { Airport } from "./types";

export interface Dataset extends FlightsFile {
  airports: Map<string, Airport>;
}

export const AIRPORTS_PATH = path.join(process.cwd(), "data", "airports.json");

/** How long a server instance reuses flight data before re-reading storage. */
const FLIGHTS_TTL_MS = 10 * 60_000;

let airportsPromise: Promise<Map<string, Airport>> | null = null;
let flightsCache: { loadedAt: number; file: FlightsFile } | null = null;

export function loadAirports(): Promise<Map<string, Airport>> {
  airportsPromise ??= readFile(AIRPORTS_PATH, "utf8")
    .then((text) => new Map((JSON.parse(text) as Airport[]).map((a) => [a.icao, a])))
    .catch((error) => {
      airportsPromise = null;
      throw new Error(`Failed to read ${AIRPORTS_PATH}: ${(error as Error).message}`);
    });
  return airportsPromise;
}

async function loadFlights(): Promise<FlightsFile> {
  if (flightsCache && Date.now() - flightsCache.loadedAt < FLIGHTS_TTL_MS) return flightsCache.file;
  const file = await readFlightsFile();
  flightsCache = { loadedAt: Date.now(), file };
  return file;
}

export async function loadDataset(): Promise<Dataset> {
  const [airports, file] = await Promise.all([loadAirports(), loadFlights()]);
  // Never serve records past the retention limit, even if a scheduled refresh was missed.
  return { ...file, flights: pruneExpired(file.flights, new Date(), MAX_RETENTION_MS), airports };
}
