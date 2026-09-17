import type { FlightRecord } from "./types";

/**
 * Removes exact repeats and generic names that have a more specific variant in the list,
 * e.g. "Airbus A380" + "Airbus A380-800" → "Airbus A380-800". Different types such as
 * "Airbus A320" and "Airbus A320 NEO" are both kept.
 */
export function mergeAircraftNames(names: readonly string[]): string[] {
  const unique = [...new Set(names)];
  return unique.filter((name) => !unique.some((other) => other.startsWith(`${name}-`) || other.startsWith(`${name} (`)));
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.values()];
}

/** The record whose (departure time, duration) combination occurs most often in the group. */
function mostCommonSchedule(group: readonly FlightRecord[]): FlightRecord {
  const bySchedule = groupBy(group, (f) => `${f.depLocal}|${f.durationMin}`);
  return bySchedule.reduce((best, g) => (g.length > best.length ? g : best))[0];
}

const flightNumberOrder = (a: string, b: string) =>
  (Number(a.replace(/\D/g, "")) || Infinity) - (Number(b.replace(/\D/g, "")) || Infinity) || a.localeCompare(b);

/**
 * Collapses one pull's observations into one record per flight:
 * 1. same airline, route and departure time under several flight numbers → keep the lowest number
 *    (unlabelled codeshares in future schedules);
 * 2. same flight number and route seen on several days → one record listing every aircraft seen.
 */
export function consolidateFlights(records: readonly FlightRecord[]): FlightRecord[] {
  const withoutAliases = groupBy(
    records,
    (f) => `${f.airline.icao || f.airline.iata}|${f.depIcao}|${f.arrIcao}|${f.depLocal}`,
  ).flatMap((slot) => {
    const keep = [...new Set(slot.map((f) => f.flightNumber))].sort(flightNumberOrder)[0];
    return slot.filter((f) => f.flightNumber === keep);
  });

  return groupBy(withoutAliases, (f) => f.id).map((group) => ({
    ...mostCommonSchedule(group),
    aircraft: mergeAircraftNames(group.flatMap((f) => f.aircraft)),
  }));
}
