/**
 * Downloads OurAirports (public domain) and writes data/airports.json with airport sizes.
 * Usage: npm run data:airports
 */
import { writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { AIRPORTS_PATH } from "../src/lib/data";
import type { Airport } from "@/lib/types";
import { classifyAirportSize, type AirportRunway } from "@/lib/airport-sizes";

const SOURCE_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";

const RUNWAYS_URL = "https://davidmegginson.github.io/ourairports-data/runways.csv";
const AIRPORT_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

interface OurAirportsRow {
  ident: string;
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  iso_country: string;
  municipality: string;
  icao_code: string;
  iata_code: string;
  gps_code: string;
  scheduled_service: string;
}

async function main() {
  const [airportCsv, runwayCsv] = await Promise.all([SOURCE_URL, RUNWAYS_URL].map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OurAirports download failed: HTTP ${res.status} (${url})`);
    return res.text();
  }));
  const rows: OurAirportsRow[] = parse(airportCsv, { columns: true, skip_empty_lines: true });
  const runways: (AirportRunway & { airport_ident: string })[] = parse(runwayCsv, { columns: true, skip_empty_lines: true });
  const runwaysByAirport = new Map<string, AirportRunway[]>();
  for (const runway of runways) {
    const group = runwaysByAirport.get(runway.airport_ident) ?? [];
    group.push(runway);
    runwaysByAirport.set(runway.airport_ident, group);
  }

  const entries = rows.flatMap((row) => {
    const icao = (row.icao_code || row.gps_code).toUpperCase();
    if (!AIRPORT_TYPES.has(row.type) || !/^[A-Z0-9]{4}$/.test(icao)) return [];
    const size = classifyAirportSize(row.type, row.scheduled_service === "yes", runwaysByAirport.get(row.ident) ?? []);
    const airport: Airport = {
      icao,
      iata: row.iata_code,
      name: row.name,
      city: row.municipality,
      country: row.iso_country,
      size,
      lat: Number(Number(row.latitude_deg).toFixed(4)),
      lon: Number(Number(row.longitude_deg).toFixed(4)),
    };
    return [{ airport, ident: row.ident.toUpperCase() }];
  });

  const primary = entries.map((e) => e.airport);
  const taken = new Set(primary.map((a) => a.icao));
  // Schedule feeds sometimes still use a superseded ICAO code, which OurAirports keeps as `ident`.
  // Aliases never shadow an airport's current code.
  const aliases = entries
    .filter(({ airport, ident }) => ident !== airport.icao && /^[A-Z]{4}$/.test(ident) && !taken.has(ident))
    .map(({ airport, ident }) => ({ ...airport, icao: ident }));
  const airports = [...primary, ...aliases];

  await writeFile(AIRPORTS_PATH, JSON.stringify(airports));
  process.stdout.write(`Wrote ${airports.length} airports to ${AIRPORTS_PATH}\n`);
}

main().catch((error) => {
  process.stderr.write(`build-airports: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
