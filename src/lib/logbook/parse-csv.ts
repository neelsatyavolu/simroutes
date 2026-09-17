import { parse } from "csv-parse/sync";

export interface ParsedLogbookRow {
  /** Airport code as written (ICAO or IATA), upper-cased. Resolved to ICAO on import. */
  dep: string;
  arr: string;
  aircraft: string | null;
  blockMinutes: number | null;
  flownAt: string | null;
  externalId: string | null;
}

export interface ParseResult {
  rows: ParsedLogbookRow[];
  errors: string[];
}

export const MAX_ROWS = 5000;

const key = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

// Candidate header keys per field, most specific first.
const COLUMNS = {
  dep: ["departureicao", "depicao", "originicao", "fromicao", "departureident", "departureairport", "departure", "dep", "origin", "from"],
  arr: ["arrivalicao", "arricao", "destinationicao", "toicao", "destinationident", "arrivalairport", "destinationairport", "arrival", "arr", "destination", "dest", "to"],
  aircraftType: ["aircrafticao", "icaotype", "aircrafttype", "actype", "type", "equipment"],
  aircraftName: ["aircraft", "aircraftname", "aircrafttitle", "model"],
  blockClock: ["blocktime", "blocktimereal", "duration", "flighttime", "totaltime", "time"],
  blockMinutes: ["blockminutes", "durationminutes", "flightminutes", "minutes"],
  blockHours: ["blockhours", "durationhours", "flighthours", "hours"],
  start: ["departuretimereal", "offblocks", "departuretime", "date", "dateofflight", "flownat", "startdate"],
  end: ["destinationtimereal", "onblocks", "arrivaltime"],
  id: ["id", "flightid", "uuid"],
} as const;

const AIRPORT_CODE = /^[A-Z0-9]{3,4}$/;

function findColumn(headers: string[], candidates: readonly string[]): string | undefined {
  const byKey = new Map(headers.map((h) => [key(h), h]));
  for (const c of candidates) {
    const header = byKey.get(c);
    if (header) return header;
  }
  return undefined;
}

/** "1:35" / "01:35:00" → 95 */
function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

/** Parses a timestamp; values without a timezone are treated as UTC, since logbooks record zulu time. */
function parseTimestamp(value: string | undefined): number {
  const v = value?.trim();
  if (!v) return NaN;
  const iso = v.includes("T") ? v : v.replace(" ", "T");
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const withZone = hasZone || isDateOnly || !/^\d{4}-\d{2}-\d{2}T/.test(iso) ? iso : `${iso}Z`;
  return Date.parse(withZone);
}

const positive = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

export function parseLogbookCsv(text: string): ParseResult {
  let records: Record<string, string>[];
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (error) {
    return { rows: [], errors: [`Could not read CSV: ${(error as Error).message}`] };
  }
  const headers = records.length ? Object.keys(records[0]) : [];
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([field, candidates]) => [field, findColumn(headers, candidates)]),
  ) as Record<keyof typeof COLUMNS, string | undefined>;

  if (!col.dep || !col.arr) {
    return { rows: [], errors: ['Could not find origin and destination columns (e.g. "origin", "departure", "from")'] };
  }

  const rows: ParsedLogbookRow[] = [];
  const errors: string[] = [];
  records.slice(0, MAX_ROWS).forEach((r, i) => {
    const rowNo = i + 2; // Spreadsheet line number: the header is line 1.
    const dep = (r[col.dep!] ?? "").toUpperCase();
    const arr = (r[col.arr!] ?? "").toUpperCase();
    if (!dep) return errors.push(`Row ${rowNo}: missing origin`);
    if (!arr) return errors.push(`Row ${rowNo}: missing destination`);
    if (!AIRPORT_CODE.test(dep)) return errors.push(`Row ${rowNo}: invalid origin "${dep}"`);
    if (!AIRPORT_CODE.test(arr)) return errors.push(`Row ${rowNo}: invalid destination "${arr}"`);

    const start = col.start ? parseTimestamp(r[col.start]) : NaN;
    const end = col.end ? parseTimestamp(r[col.end]) : NaN;
    const blockMinutes =
      (col.blockClock && parseClock(r[col.blockClock] ?? "")) ||
      (col.blockMinutes && r[col.blockMinutes] ? positive(Number(r[col.blockMinutes])) : null) ||
      (col.blockHours && r[col.blockHours] ? positive(Number(r[col.blockHours]) * 60) : null) ||
      (Number.isFinite(start) && Number.isFinite(end) ? positive((end - start) / 60_000) : null) ||
      null;

    rows.push({
      dep,
      arr,
      aircraft: (col.aircraftType && r[col.aircraftType]) || (col.aircraftName && r[col.aircraftName]) || null,
      blockMinutes,
      flownAt: Number.isFinite(start) ? new Date(start).toISOString() : null,
      externalId: (col.id && r[col.id]) || null,
    });
  });
  if (records.length > MAX_ROWS) errors.push(`Only the first ${MAX_ROWS} rows were imported`);
  return { rows, errors };
}
