/**
 * Pulls a week of real scheduled flights (arrivals + departures) from AeroDataBox via RapidAPI
 * and stores them in the private Vercel Blob store (or data/flights.json when no Blob token is set).
 *
 * Usage:
 *   npm run data:flights                          # default airports, 7 days from today (UTC date)
 *   npm run data:flights -- LOWI LPMA --days 2    # specific airports (ICAO) / fewer days
 *   npm run data:flights -- --start 2026-10-01    # choose the first day
 *
 * Cost: 2 API units per call; each airport-day is 2 calls (two 12h windows).
 * Requires AERODATABOX_RAPIDAPI_KEY (read from .env.ingest or .env.local, or the environment).
 */
import { MAX_RETENTION_MS, readFlightsFile, writeFlightsFile } from "../src/lib/flight-store";
import { buildWindows, mergeFlights, normalizeFlight, pruneExpired } from "../src/lib/normalize";
import type { FlightRecord } from "../src/lib/types";

const HOST = "aerodatabox.p.rapidapi.com";
const UNITS_PER_CALL = 2;
const REQUEST_GAP_MS = 1_100; // Stay under 1 request/second.

// Chosen for route coverage: every route into or out of these airports is captured.
const DEFAULT_AIRPORTS = [
  // North America
  "KATL", "KORD", "KDFW", "KDEN", "KLAX", "KJFK", "KSFO", "KMIA", "CYYZ", "MMMX",
  // South America
  "SBGR", "SKBO", "SCEL",
  // Europe
  "EGLL", "LFPG", "EDDF", "EHAM", "LEMD", "LIRF", "LTFM", "ENGM",
  // Middle East & Africa
  "OMDB", "HECA", "FAOR",
  // Asia & Oceania
  "VIDP", "VHHH", "RJTT", "RKSI", "WSSS", "VTBS", "YSSY", "NZAA",
];

const log = (msg: string) => process.stdout.write(`${msg}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv: string[]) {
  const valueOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const days = Number(valueOf("--days") ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 7) throw new Error("--days must be an integer from 1 to 7");
  const start = valueOf("--start") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("--start must be YYYY-MM-DD");

  const flagValues = new Set(["--days", "--start"].map((f) => argv.indexOf(f) + 1).filter((i) => i > 0));
  const codes = argv.filter((a, i) => !a.startsWith("--") && !flagValues.has(i)).map((c) => c.toUpperCase());
  const airports = codes.length ? codes : DEFAULT_AIRPORTS;
  const invalid = airports.filter((c) => !/^[A-Z0-9]{4}$/.test(c));
  if (invalid.length) throw new Error(`Not ICAO codes: ${invalid.join(", ")}`);
  return { airports, days, start };
}

class QuotaError extends Error {}

async function fetchBoard(key: string, icao: string, from: string, to: string) {
  const params = new URLSearchParams({
    direction: "Both",
    withLeg: "true",
    withCancelled: "false",
    withCodeshared: "false",
    withCargo: "false",
    withPrivate: "false",
  });
  const res = await fetch(`https://${HOST}/flights/airports/icao/${icao}/${from}/${to}?${params}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
  });
  const unitsLeft = res.headers.get("x-ratelimit-api-units-remaining");
  if (res.status === 204) return { departures: [], arrivals: [], unitsLeft };
  if (res.status === 429) throw new QuotaError(`HTTP 429 ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { departures?: unknown[]; arrivals?: unknown[] };
  return { departures: body.departures ?? [], arrivals: body.arrivals ?? [], unitsLeft };
}

async function main() {
  const key = process.env.AERODATABOX_RAPIDAPI_KEY;
  if (!key) throw new Error("AERODATABOX_RAPIDAPI_KEY is not set (add it to .env.ingest)");
  const { airports, days, start } = parseArgs(process.argv.slice(2));
  const windows = buildWindows(start, days);
  const calls = airports.length * windows.length;
  log(`${airports.length} airports × ${windows.length} windows from ${start} = ${calls} calls ≈ ${calls * UNITS_PER_CALL} API units`);

  const seenAt = new Date().toISOString();
  let incoming: FlightRecord[] = [];
  let failures = 0;
  let unitsLeft: string | null = null;

  outer: for (const icao of airports) {
    let airportCount = 0;
    for (const { from, to } of windows) {
      try {
        const board = await fetchBoard(key, icao, from, to);
        unitsLeft = board.unitsLeft ?? unitsLeft;
        const records = [
          ...board.departures.flatMap((r) => normalizeFlight(r, { icao, direction: "Departure" }, seenAt) ?? []),
          ...board.arrivals.flatMap((r) => normalizeFlight(r, { icao, direction: "Arrival" }, seenAt) ?? []),
        ];
        incoming = [...incoming, ...records];
        airportCount += records.length;
      } catch (error) {
        failures++;
        log(`  ${icao} ${from}: FAILED ${(error as Error).message}`);
        if (error instanceof QuotaError) {
          log("Rate limit or monthly quota reached; stopping early.");
          break outer;
        }
      }
      await sleep(REQUEST_GAP_MS);
    }
    log(`  ${icao}: ${airportCount} usable flights (units left: ${unitsLeft ?? "?"})`);
  }

  if (incoming.length === 0) throw new Error(`No flights fetched (${failures} failed calls); existing data left untouched`);

  const existing = await readFlightsFile();
  const flights = pruneExpired(mergeFlights(existing.flights, incoming), new Date(), MAX_RETENTION_MS);
  const target = await writeFlightsFile({ updatedAt: seenAt, flights });
  log(`Done: ${incoming.length} fetched, ${flights.length} unique flights saved to ${target}, ${failures} failed calls, units left: ${unitsLeft ?? "?"}`);
}

main().catch((error) => {
  process.stderr.write(`ingest: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
