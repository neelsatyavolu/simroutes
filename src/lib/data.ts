import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Airport, FlightRecord } from "./types";

export interface FlightsFile {
  updatedAt: string | null;
  flights: FlightRecord[];
}

export interface Dataset extends FlightsFile {
  airports: Map<string, Airport>;
}

const DATA_DIR = path.join(process.cwd(), "data");
export const FLIGHTS_PATH = process.env.FLIGHTS_FILE ?? path.join(DATA_DIR, "flights.json");
export const AIRPORTS_PATH = path.join(DATA_DIR, "airports.json");

let cache: { key: string; dataset: Dataset } | null = null;

async function mtime(file: string): Promise<number> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw new Error(`Failed to read data file ${file}: ${(error as Error).message}`);
  }
}

/** Loads the dataset, re-reading from disk only when the files change (e.g. after an ingest run). */
export async function loadDataset(): Promise<Dataset> {
  const key = `${await mtime(FLIGHTS_PATH)}:${await mtime(AIRPORTS_PATH)}`;
  if (cache?.key === key) return cache.dataset;

  const [flightsFile, airports] = await Promise.all([
    readJson<FlightsFile>(FLIGHTS_PATH, { updatedAt: null, flights: [] }),
    readJson<Airport[]>(AIRPORTS_PATH, []),
  ]);
  const dataset: Dataset = { ...flightsFile, airports: new Map(airports.map((a) => [a.icao, a])) };
  cache = { key, dataset };
  return dataset;
}
