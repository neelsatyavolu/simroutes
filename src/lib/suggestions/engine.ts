import { resolveType } from "../aircraft-types";
import type { Airport, FlightRecord, FlightResult } from "../types";

export interface LogbookEntry {
  depIcao: string;
  arrIcao: string;
  /** Raw aircraft as imported: ICAO code, schedule name or sim title. */
  aircraft: string | null;
  blockMinutes: number | null;
  flownAt: string | null;
}

export interface Profile {
  /** Up to 3 aircraft, most preferred first. */
  aircraft: { code: string; family: string; weight: number }[];
  duration: { min: number; max: number; median: number } | null;
  lastArrival: string | null;
  visited: Set<string>;
}

export type Relaxation = "aircraft" | "duration";

export interface SuggestionRow {
  results: FlightResult[];
  /** Constraints dropped because nothing matched them. */
  relaxed: Relaxation[];
}

export interface Suggestions {
  continueFrom: (SuggestionRow & { from: string }) | null;
  discover: SuggestionRow;
}

const HALF_LIFE_DAYS = 90;
const TOP_AIRCRAFT = 3;
const DAY_MS = 86_400_000;

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function durationRange(minutes: number[]): Profile["duration"] {
  if (minutes.length === 0) return null;
  const sorted = [...minutes].sort((a, b) => a - b);
  const median = Math.round(percentile(sorted, 0.5));
  // Few flights: widen around what we have. More flights: trim outliers, then pad.
  return sorted.length < 3
    ? { min: Math.round(sorted[0] * 0.7), max: Math.round(sorted[sorted.length - 1] * 1.3), median }
    : { min: Math.round(percentile(sorted, 0.2) * 0.85), max: Math.round(percentile(sorted, 0.8) * 1.15), median };
}

export function buildProfile(entries: readonly LogbookEntry[], now: Date): Profile {
  const weights = new Map<string, { code: string; family: string; weight: number }>();
  for (const e of entries) {
    const type = e.aircraft ? resolveType(e.aircraft) : null;
    if (!type?.code) continue;
    const ageDays = e.flownAt ? Math.max(0, (now.getTime() - Date.parse(e.flownAt)) / DAY_MS) : 0;
    const w = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    const prev = weights.get(type.code);
    weights.set(type.code, { code: type.code, family: type.family, weight: (prev?.weight ?? 0) + w });
  }

  // Latest flight by date; undated rows count as later in file order.
  const latest = entries.reduce<{ e: LogbookEntry; i: number } | null>((best, e, i) => {
    if (!best) return { e, i };
    const t = e.flownAt ? Date.parse(e.flownAt) : Infinity;
    const bt = best.e.flownAt ? Date.parse(best.e.flownAt) : Infinity;
    return t > bt || (t === bt && i > best.i) ? { e, i } : best;
  }, null);

  return {
    aircraft: [...weights.values()].sort((a, b) => b.weight - a.weight).slice(0, TOP_AIRCRAFT),
    duration: durationRange(entries.flatMap((e) => (e.blockMinutes ? [e.blockMinutes] : []))),
    lastArrival: latest?.e.arrIcao ?? null,
    visited: new Set(entries.flatMap((e) => [e.depIcao, e.arrIcao])),
  };
}

/** Deterministic [0, 1) from a string, so suggestions rotate by seed (e.g. the date) but are stable within it. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

interface Candidate {
  flight: FlightRecord;
  /** 2 = preferred type, 1 = same family, 0 = other. */
  aircraftScore: number;
  inRange: boolean;
}

const typeCache = new Map<string, ReturnType<typeof resolveType>>();
const cachedType = (name: string) => {
  if (!typeCache.has(name)) typeCache.set(name, resolveType(name));
  return typeCache.get(name)!;
};

function evaluate(profile: Profile, flight: FlightRecord): Candidate {
  const codes = new Set(profile.aircraft.map((a) => a.code));
  const families = new Set(profile.aircraft.map((a) => a.family));
  let aircraftScore = 0;
  for (const name of flight.aircraft) {
    const t = cachedType(name);
    if (t?.code && codes.has(t.code)) aircraftScore = 2;
    else if (t && families.has(t.family)) aircraftScore = Math.max(aircraftScore, 1);
  }
  const d = profile.duration;
  return { flight, aircraftScore, inRange: !d || (flight.durationMin >= d.min && flight.durationMin <= d.max) };
}

// Tried in order; the first tier with any matches wins.
const TIERS: { relaxed: Relaxation[]; accept: (c: Candidate, hasAircraft: boolean) => boolean }[] = [
  { relaxed: [], accept: (c, has) => (!has || c.aircraftScore > 0) && c.inRange },
  { relaxed: ["aircraft"], accept: (c) => c.inRange },
  { relaxed: ["duration"], accept: (c, has) => !has || c.aircraftScore > 0 },
  { relaxed: ["aircraft", "duration"], accept: () => true },
];

function pickTier(profile: Profile, pool: readonly Candidate[]) {
  const hasAircraft = profile.aircraft.length > 0;
  for (const tier of TIERS) {
    const matches = pool.filter((c) => tier.accept(c, hasAircraft));
    if (matches.length) return { matches, relaxed: tier.relaxed };
  }
  return { matches: [], relaxed: [] as Relaxation[] };
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k) || seen.size >= limit) return false;
    seen.add(k);
    return true;
  });
}

const withAirports = (f: FlightRecord, airports: ReadonlyMap<string, Airport>): FlightResult => ({
  ...f,
  dep: airports.get(f.depIcao) ?? null,
  arr: airports.get(f.arrIcao) ?? null,
});

export function suggestFlights(
  profile: Profile,
  flights: readonly FlightRecord[],
  airports: ReadonlyMap<string, Airport>,
  { seed, limit = 6 }: { seed: string; limit?: number },
): Suggestions {
  const median = profile.duration?.median ?? 0;

  let continueFrom: Suggestions["continueFrom"] = null;
  if (profile.lastArrival) {
    const from = profile.lastArrival;
    const { matches, relaxed } = pickTier(profile, flights.filter((f) => f.depIcao === from).map((f) => evaluate(profile, f)));
    const ranked = [...matches].sort(
      (a, b) =>
        b.aircraftScore - a.aircraftScore ||
        Number(profile.visited.has(a.flight.arrIcao)) - Number(profile.visited.has(b.flight.arrIcao)) ||
        Math.abs(a.flight.durationMin - median) - Math.abs(b.flight.durationMin - median),
    );
    const results = uniqueBy(ranked, (c) => c.flight.arrIcao, limit).map((c) => withAirports(c.flight, airports));
    continueFrom = { from, results, relaxed };
  }

  const shown = new Set(continueFrom?.results.map((f) => f.id));
  const unvisited = flights
    .filter((f) => !profile.visited.has(f.arrIcao) && !shown.has(f.id))
    .map((f) => evaluate(profile, f));
  const { matches, relaxed } = pickTier(profile, unvisited);
  const score = (c: Candidate) =>
    c.aircraftScore + (profile.visited.has(c.flight.depIcao) ? 1 : 0) + jitter(`${seed}|${c.flight.id}`);
  const ranked = [...matches].sort((a, b) => score(b) - score(a));
  const countryOf = (c: Candidate) => airports.get(c.flight.arrIcao)?.country ?? c.flight.arrIcao;
  const discover = {
    results: uniqueBy(ranked, countryOf, limit).map((c) => withAirports(c.flight, airports)),
    relaxed,
  };

  return { continueFrom, discover };
}
