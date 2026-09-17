import { jsonError, serverError } from "@/lib/api";
import { loadAirports } from "@/lib/data";
import { matchScenery, parseSceneryCatalog, SCENERY_SOURCE } from "@/lib/scenery";
import type { SceneryResponse } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ icao: string }> }) {
  const { icao } = await context.params;
  try {
    if (!(await loadAirports()).has(icao)) return jsonError("Airport not found", 404);
    const response = await fetch(SCENERY_SOURCE, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return jsonError("Scenery listings are temporarily unavailable. Try again or open the source list.", 502);
    const catalog = parseSceneryCatalog(await response.text());
    return Response.json({ ...matchScenery(catalog, icao), sourceUrl: SCENERY_SOURCE } satisfies SceneryResponse);
  } catch (error) {
    return serverError("GET /api/airports/[icao]/scenery", error);
  }
}
