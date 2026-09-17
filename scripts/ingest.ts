/**
 * Pulls real scheduled departures from AeroDataBox (via RapidAPI) and merges them into data/flights.json.
 *
 * Usage:
 *   npm run data:flights                     # default hub list, one 12h window each
 *   npm run data:flights -- EGLL KJFK LOWI   # specific airports (ICAO)
 *   npm run data:flights -- --windows 2      # 24h of departures per airport (2 calls each)
 *
 * Cost: each call is a Tier 2 endpoint = 2 API units. The free Basic plan has 600 units/month.
 * Requires AERODATABOX_RAPIDAPI_KEY in .env.local.
 */
import { readFile, writeFile } from "node:fs/promises";
import { FLIGHTS_PATH, type FlightsFile } from "../src/lib/data";
import { mergeFlights, normalizeDeparture } from "../src/lib/normalize";
import type { FlightRecord } from "../src/lib/types";

const HOST = "aerodatabox.p.rapidapi.com";
const UNITS_PER_CALL = 2;
const WINDOW_MINUTES = 720;
const REQUEST_GAP_MS = 1_100; // Basic plan allows 1 request/second.

const DEFAULT_AIRPORTS = [
  "KATL", "KLAX", "KORD", "KDFW", "KDEN", "KJFK", "KSFO", "KSEA", "CYYZ", "MMMX",
  "SBGR", "EGLL", "LFPG", "EDDF", "EHAM", "LEMD", "LIRF", "LTFM", "OMDB", "VIDP",
  "VHHH", "RJTT", "RKSI", "WSSS", "YSSY",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (msg: string) => process.stdout.write(`${msg}\n`);

function parseArgs(argv: string[]) {
  const windowsIdx = argv.indexOf("--windows");
  const windows = windowsIdx >= 0 ? Number(argv[windowsIdx + 1]) : 1;
  if (!Number.isInteger(windows) || windows < 1 || windows > 4) {
    throw new Error("--windows must be an integer from 1 to 4");
  }
  const codes = argv.filter((a, i) => !a.startsWith("--") && (windowsIdx < 0 || i !== windowsIdx + 1));
  const airports = (codes.length ? codes : DEFAULT_AIRPORTS).map((c) => c.toUpperCase());
  const invalid = airports.filter((c) => !/^[A-Z0-9]{4}$/.test(c));
  if (invalid.length) throw new Error(`Not ICAO codes: ${invalid.join(", ")}`);
  return { airports, windows };
}

async function fetchDepartures(key: string, icao: string, offsetMinutes: number): Promise<unknown[]> {
  const params = new URLSearchParams({
    offsetMinutes: String(offsetMinutes),
    durationMinutes: String(WINDOW_MINUTES),
    direction: "Departure",
    withLeg: "true",
    withCancelled: "false",
    withCodeshared: "false",
    withCargo: "false",
    withPrivate: "false",
  });
  const res = await fetch(`https://${HOST}/flights/airports/icao/${icao}?${params}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { departures?: unknown[] };
  return body.departures ?? [];
}

async function readExisting(): Promise<FlightsFile> {
  try {
    return JSON.parse(await readFile(FLIGHTS_PATH, "utf8")) as FlightsFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { updatedAt: null, flights: [] };
    throw error;
  }
}

async function main() {
  const key = process.env.AERODATABOX_RAPIDAPI_KEY;
  if (!key) throw new Error("AERODATABOX_RAPIDAPI_KEY is not set (add it to .env.local)");
  const { airports, windows } = parseArgs(process.argv.slice(2));
  log(`Fetching ${airports.length} airports × ${windows} window(s) ≈ ${airports.length * windows * UNITS_PER_CALL} API units`);

  const seenAt = new Date().toISOString();
  let incoming: FlightRecord[] = [];
  let failures = 0;

  let quotaHit = false;
  for (const icao of airports) {
    for (let w = 0; w < windows && !quotaHit; w++) {
      try {
        const raw = await fetchDepartures(key, icao, w * WINDOW_MINUTES);
        const records = raw.flatMap((r) => normalizeDeparture(r, icao, seenAt) ?? []);
        incoming = [...incoming, ...records];
        log(`  ${icao} +${w * 12}h: ${raw.length} departures, ${records.length} usable`);
      } catch (error) {
        failures++;
        log(`  ${icao} +${w * 12}h: FAILED ${(error as Error).message}`);
        if (String((error as Error).message).startsWith("HTTP 429")) {
          log("Rate limit or monthly quota reached; stopping early.");
          quotaHit = true;
        }
      }
      await sleep(REQUEST_GAP_MS);
    }
  }

  const existing = await readExisting();
  const flights = mergeFlights(existing.flights, incoming);
  await writeFile(FLIGHTS_PATH, JSON.stringify({ updatedAt: seenAt, flights } satisfies FlightsFile));
  log(`Done: ${incoming.length} fetched, ${flights.length} total flights saved, ${failures} failed calls.`);
  if (failures > 0 && incoming.length === 0) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`ingest: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
