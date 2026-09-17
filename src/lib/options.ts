import type { Dataset } from "./data";
import type { OptionsResponse } from "./types";

const byCountDesc = (a: { count: number }, b: { count: number }) => b.count - a.count;

export function buildOptions({ flights, airports, updatedAt }: Dataset): OptionsResponse {
  const aircraft = new Map<string, number>();
  const airlines = new Map<string, { name: string; code: string; count: number }>();
  const airportCounts = new Map<string, number>();

  for (const f of flights) {
    for (const model of f.aircraft) aircraft.set(model, (aircraft.get(model) ?? 0) + 1);
    const code = f.airline.iata || f.airline.icao;
    if (code) {
      const prev = airlines.get(code);
      airlines.set(code, { name: f.airline.name || code, code, count: (prev?.count ?? 0) + 1 });
    }
    for (const icao of [f.depIcao, f.arrIcao]) airportCounts.set(icao, (airportCounts.get(icao) ?? 0) + 1);
  }

  return {
    aircraft: [...aircraft].map(([model, count]) => ({ model, count })).sort(byCountDesc),
    airlines: [...airlines.values()].sort(byCountDesc),
    airports: [...airportCounts].map(([icao, count]) => {
      const a = airports.get(icao);
      return { icao, iata: a?.iata ?? "", name: a?.name ?? icao, city: a?.city ?? "", country: a?.country ?? "", count };
    }),
    flightCount: flights.length,
    updatedAt,
  };
}
