import { serverError } from "@/lib/api";
import { loadAirports } from "@/lib/data";
import { rankAirports } from "@/lib/airport-search";
import type { AirportsResponse } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
    if (!query) return Response.json({ airports: [] } satisfies AirportsResponse);
    const airports = await loadAirports();
    const matches = rankAirports([...airports.values()].map((a) => ({ ...a, count: 0 })), query, 30);
    return Response.json({ airports: matches.map((a) => airports.get(a.icao)!) } satisfies AirportsResponse);
  } catch (error) {
    return serverError("GET /api/airports", error);
  }
}
