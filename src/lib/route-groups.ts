import type { FlightResult } from "@/lib/types";

export interface RouteGroup {
  id: string;
  flights: FlightResult[];
  airlines: string[];
  firstDeparture: string;
  lastDeparture: string;
  minDuration: number;
  maxDuration: number;
}

/** Keep routes and their flights in search order, including the selected sort. */
export function groupFlightsByRoute(flights: readonly FlightResult[]): RouteGroup[] {
  const groups = new Map<string, RouteGroup>();
  for (const flight of flights) {
    const id = `${flight.depIcao}-${flight.arrIcao}`;
    const group = groups.get(id);
    if (group) {
      group.flights.push(flight);
      if (!group.airlines.includes(flight.airline.name)) group.airlines.push(flight.airline.name);
      if (flight.depLocal < group.firstDeparture) group.firstDeparture = flight.depLocal;
      if (flight.depLocal > group.lastDeparture) group.lastDeparture = flight.depLocal;
      group.minDuration = Math.min(group.minDuration, flight.durationMin);
      group.maxDuration = Math.max(group.maxDuration, flight.durationMin);
    } else {
      groups.set(id, {
        id, flights: [flight], airlines: [flight.airline.name],
        firstDeparture: flight.depLocal, lastDeparture: flight.depLocal,
        minDuration: flight.durationMin, maxDuration: flight.durationMin,
      });
    }
  }
  return [...groups.values()];
}
