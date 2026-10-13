import { jsonError, serverError } from "@/lib/api";
import { loadAirports } from "@/lib/data";
import { matchScenery, SCENERY_SOURCE } from "@/lib/scenery";
import { loadSceneryCatalog } from "@/lib/scenery-store";
import type { SceneryResponse } from "@/lib/types";

const ICAO = /^[A-Z0-9]{4}$/;

export async function GET(_request: Request, context: { params: Promise<{ icao: string }> }) {
  const icao = (await context.params).icao.trim().toUpperCase();
  if (!ICAO.test(icao)) return jsonError("Airport not found", 404);
  try {
    if (!(await loadAirports()).has(icao)) return jsonError("Airport not found", 404);
    const catalog = await loadSceneryCatalog();
    return Response.json({ ...matchScenery(catalog.entries, icao), sourceUrl: SCENERY_SOURCE, fallbackUpdatedAt: catalog.fallbackUpdatedAt } satisfies SceneryResponse);
  } catch (error) {
    return serverError("GET /api/airports/[icao]/scenery", error);
  }
}
